package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/aws/aws-lambda-go/events"
	"github.com/google/uuid"

	"github.com/isaac-evs/friends_nearby/backend/internal/auth"
	"github.com/isaac-evs/friends_nearby/backend/internal/config"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

const maxBodyBytes = 16 * 1024

var usernameRe = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

type httpResp = events.APIGatewayV2HTTPResponse

// request bundles what route handlers need.
type request struct {
	ctx    context.Context
	ev     events.APIGatewayV2HTTPRequest
	body   []byte
	userID string // set for authenticated routes
}

func (r *request) decode(dst any) error {
	if err := json.Unmarshal(r.body, dst); err != nil {
		return errors.New("invalid JSON body")
	}
	return nil
}

func (h *Handler) handleHTTP(ctx context.Context, ev events.APIGatewayV2HTTPRequest) httpResp {
	method := ev.RequestContext.HTTP.Method
	path := strings.TrimSuffix(ev.RawPath, "/")
	if path == "" {
		path = "/"
	}

	body := []byte(ev.Body)
	if ev.IsBase64Encoded {
		decoded, err := base64.StdEncoding.DecodeString(ev.Body)
		if err != nil {
			return respond(400, errBody("invalid body encoding"))
		}
		body = decoded
	}
	if len(body) > maxBodyBytes {
		return respond(413, errBody("body too large"))
	}
	r := &request{ctx: ctx, ev: ev, body: body}

	// Public routes.
	switch {
	case method == "POST" && path == "/auth/register":
		return h.register(r)
	case method == "POST" && path == "/auth/login":
		return h.login(r)
	}

	// Everything else needs a valid bearer token.
	token := strings.TrimPrefix(ev.Headers["authorization"], "Bearer ")
	userID, err := h.App.Auth.Verify(token)
	if err != nil {
		return respond(401, errBody("unauthorized"))
	}
	r.userID = userID

	parts := strings.Split(strings.Trim(path, "/"), "/")
	switch {
	case method == "GET" && path == "/me":
		return h.getMe(r)
	case method == "PATCH" && path == "/me":
		return h.patchMe(r)
	case method == "POST" && path == "/me/photo-upload-url":
		return h.photoUploadURL(r)
	case method == "GET" && path == "/nearby":
		return h.nearby(r)
	case method == "GET" && path == "/users/search":
		return h.searchUser(r)
	case method == "GET" && path == "/friends":
		return h.listFriends(r)
	case method == "POST" && path == "/friends/requests":
		return h.sendRequest(r)
	case method == "POST" && len(parts) == 3 && parts[0] == "friends" && parts[2] == "accept":
		return h.acceptRequest(r, parts[1])
	case method == "DELETE" && len(parts) == 2 && parts[0] == "friends":
		return h.removeFriend(r, parts[1])
	}
	return respond(404, errBody("not found"))
}

func internalError(op string, err error) httpResp {
	slog.Error(op, "err", err)
	return respond(500, errBody("internal error"))
}

// ---------------------------------------------------------------- auth

type registerReq struct {
	Email       string `json:"email"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

func (h *Handler) register(r *request) httpResp {
	var in registerReq
	if err := r.decode(&in); err != nil {
		return respond(400, errBody(err.Error()))
	}
	email := store.NormalizeEmail(in.Email)
	username := store.NormalizeUsername(in.Username)
	if addr, err := mail.ParseAddress(email); err != nil || addr.Address != email || len(email) > 254 {
		return respond(400, errBody("invalid email"))
	}
	if !usernameRe.MatchString(username) {
		return respond(400, errBody("username must be 3-20 characters: a-z, 0-9 or _"))
	}
	if n := len(in.Password); n < 8 || n > 72 {
		return respond(400, errBody("password must be 8-72 bytes"))
	}
	display := strings.TrimSpace(in.DisplayName)
	if display == "" {
		display = username
	}
	if utf8.RuneCountInString(display) > 50 {
		return respond(400, errBody("display_name too long (max 50)"))
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return internalError("hash password", err)
	}
	u := &models.User{
		UserID:       uuid.NewString(),
		Email:        email,
		Username:     username,
		DisplayName:  display,
		PasswordHash: hash,
		RadiusM:      config.DefaultRadiusM,
		CreatedAt:    time.Now().Unix(),
	}
	switch err := h.App.Store.CreateUser(r.ctx, u); {
	case errors.Is(err, store.ErrEmailTaken):
		return respond(409, errBody("email already registered"))
	case errors.Is(err, store.ErrUsernameTaken):
		return respond(409, errBody("username already taken"))
	case err != nil:
		return internalError("create user", err)
	}
	token, err := h.App.Auth.Issue(u.UserID)
	if err != nil {
		return internalError("issue token", err)
	}
	return respond(201, map[string]any{"token": token, "user": u})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) login(r *request) httpResp {
	var in loginReq
	if err := r.decode(&in); err != nil {
		return respond(400, errBody(err.Error()))
	}
	// Same response for unknown email and wrong password.
	bad := respond(401, errBody("invalid email or password"))
	id, err := h.App.Store.UserIDByEmail(r.ctx, in.Email)
	if err != nil {
		return internalError("lookup email", err)
	}
	if id == "" {
		return bad
	}
	u, err := h.App.Store.GetUser(r.ctx, id)
	if err != nil {
		return internalError("get user", err)
	}
	if u == nil || !auth.CheckPassword(u.PasswordHash, in.Password) {
		return bad
	}
	token, err := h.App.Auth.Issue(u.UserID)
	if err != nil {
		return internalError("issue token", err)
	}
	return respond(200, map[string]any{"token": token, "user": u})
}

// ---------------------------------------------------------------- profile

func (h *Handler) getMe(r *request) httpResp {
	u, err := h.App.Store.GetUser(r.ctx, r.userID)
	if err != nil {
		return internalError("get me", err)
	}
	if u == nil {
		return respond(401, errBody("unauthorized"))
	}
	return respond(200, u)
}

type patchMeReq struct {
	DisplayName *string `json:"display_name"`
	RadiusM     *int    `json:"radius_m"`
	GhostMode   *bool   `json:"ghost_mode"`
	PhotoKey    *string `json:"photo_key"`
}

func (h *Handler) patchMe(r *request) httpResp {
	var in patchMeReq
	if err := r.decode(&in); err != nil {
		return respond(400, errBody(err.Error()))
	}
	if in.DisplayName != nil {
		d := strings.TrimSpace(*in.DisplayName)
		if d == "" || utf8.RuneCountInString(d) > 50 {
			return respond(400, errBody("display_name must be 1-50 characters"))
		}
		in.DisplayName = &d
	}
	if in.RadiusM != nil && (*in.RadiusM < config.MinRadiusM || *in.RadiusM > config.MaxRadiusM) {
		return respond(400, errBody(fmt.Sprintf("radius_m must be between %d and %d", config.MinRadiusM, config.MaxRadiusM)))
	}
	if in.PhotoKey != nil && !strings.HasPrefix(*in.PhotoKey, "photos/"+r.userID+"/") {
		return respond(400, errBody("photo_key must come from /me/photo-upload-url"))
	}

	before, err := h.App.Store.GetUser(r.ctx, r.userID)
	if err != nil {
		return internalError("get user", err)
	}
	if before == nil {
		return respond(401, errBody("unauthorized"))
	}
	after, err := h.App.Store.UpdateProfile(r.ctx, r.userID, store.ProfilePatch{
		DisplayName: in.DisplayName, RadiusM: in.RadiusM, GhostMode: in.GhostMode, PhotoKey: in.PhotoKey,
	})
	if err != nil {
		return internalError("update profile", err)
	}
	// Ghost mode just turned on: vanish from every friend's view right away.
	if !before.GhostMode && after.GhostMode {
		if err := h.App.EnterGhost(r.ctx, after); err != nil {
			return internalError("enter ghost mode", err)
		}
	}
	return respond(200, after)
}

var photoTypes = map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

func (h *Handler) photoUploadURL(r *request) httpResp {
	var in struct {
		ContentType string `json:"content_type"`
	}
	if err := r.decode(&in); err != nil {
		return respond(400, errBody(err.Error()))
	}
	ext, ok := photoTypes[in.ContentType]
	if !ok {
		return respond(400, errBody("content_type must be image/jpeg, image/png or image/webp"))
	}
	key := fmt.Sprintf("photos/%s/%s.%s", r.userID, uuid.NewString(), ext)
	url, err := h.App.Presigner.PresignPut(r.ctx, key, in.ContentType, 5*time.Minute)
	if err != nil {
		return internalError("presign", err)
	}
	return respond(200, map[string]any{
		"upload_url":   url,
		"key":          key,
		"content_type": in.ContentType,
		"expires_in":   300,
	})
}

func (h *Handler) nearby(r *request) httpResp {
	list, err := h.App.Snapshot(r.ctx, r.userID)
	if err != nil {
		return internalError("snapshot", err)
	}
	return respond(200, map[string]any{"nearby": list})
}

// ---------------------------------------------------------------- friends

func (h *Handler) searchUser(r *request) httpResp {
	name := r.ev.QueryStringParameters["username"]
	if name == "" {
		return respond(400, errBody("username query parameter is required"))
	}
	id, err := h.App.Store.UserIDByUsername(r.ctx, name)
	if err != nil {
		return internalError("search user", err)
	}
	if id == "" {
		return respond(404, errBody("user not found"))
	}
	u, err := h.App.Store.GetUser(r.ctx, id)
	if err != nil || u == nil {
		if err != nil {
			return internalError("get user", err)
		}
		return respond(404, errBody("user not found"))
	}
	return respond(200, h.App.Public(u))
}

func (h *Handler) listFriends(r *request) httpResp {
	rows, err := h.App.Store.ListFriendships(r.ctx, r.userID)
	if err != nil {
		return internalError("list friendships", err)
	}
	ids := make([]string, 0, len(rows))
	for _, f := range rows {
		ids = append(ids, f.FriendID)
	}
	users, err := h.App.Store.GetUsers(r.ctx, ids)
	if err != nil {
		return internalError("get users", err)
	}
	out := map[string][]models.PublicUser{"friends": {}, "incoming": {}, "outgoing": {}}
	for _, f := range rows {
		u := users[f.FriendID]
		if u == nil {
			continue
		}
		switch f.Status {
		case models.StatusAccepted:
			out["friends"] = append(out["friends"], h.App.Public(u))
		case models.StatusPendingIn:
			out["incoming"] = append(out["incoming"], h.App.Public(u))
		case models.StatusPendingOut:
			out["outgoing"] = append(out["outgoing"], h.App.Public(u))
		}
	}
	return respond(200, out)
}

func (h *Handler) sendRequest(r *request) httpResp {
	var in struct {
		Username string `json:"username"`
	}
	if err := r.decode(&in); err != nil {
		return respond(400, errBody(err.Error()))
	}
	targetID, err := h.App.Store.UserIDByUsername(r.ctx, in.Username)
	if err != nil {
		return internalError("lookup username", err)
	}
	if targetID == "" {
		return respond(404, errBody("user not found"))
	}
	if targetID == r.userID {
		return respond(400, errBody("you cannot add yourself"))
	}
	me, err := h.App.Store.GetUser(r.ctx, r.userID)
	if err != nil || me == nil {
		if err != nil {
			return internalError("get user", err)
		}
		return respond(401, errBody("unauthorized"))
	}

	existing, err := h.App.Store.GetFriendship(r.ctx, r.userID, targetID)
	if err != nil {
		return internalError("get friendship", err)
	}
	if existing != nil {
		// They already asked me: sending a request back means accepting.
		if existing.Status == models.StatusPendingIn {
			return h.finishAccept(r, me, targetID)
		}
		return respond(409, errBody("request already sent or already friends"))
	}
	switch err := h.App.Store.CreateRequest(r.ctx, r.userID, targetID); {
	case errors.Is(err, store.ErrAlreadyExists):
		return respond(409, errBody("request already sent or already friends"))
	case err != nil:
		return internalError("create request", err)
	}
	h.App.NotifyFriendRequest(r.ctx, targetID, me)
	return respond(201, map[string]string{"status": models.StatusPendingOut})
}

func (h *Handler) acceptRequest(r *request, otherID string) httpResp {
	me, err := h.App.Store.GetUser(r.ctx, r.userID)
	if err != nil || me == nil {
		if err != nil {
			return internalError("get user", err)
		}
		return respond(401, errBody("unauthorized"))
	}
	return h.finishAccept(r, me, otherID)
}

func (h *Handler) finishAccept(r *request, me *models.User, otherID string) httpResp {
	switch err := h.App.Store.Accept(r.ctx, me.UserID, otherID); {
	case errors.Is(err, store.ErrNotPending):
		return respond(404, errBody("no pending request from that user"))
	case err != nil:
		return internalError("accept", err)
	}
	h.App.NotifyFriendAccepted(r.ctx, otherID, me)
	return respond(200, map[string]string{"status": models.StatusAccepted})
}

// removeFriend unfriends, declines an incoming request, or cancels an outgoing one.
func (h *Handler) removeFriend(r *request, otherID string) httpResp {
	f, err := h.App.Store.GetFriendship(r.ctx, r.userID, otherID)
	if err != nil {
		return internalError("get friendship", err)
	}
	if f == nil {
		return respond(404, errBody("friendship not found"))
	}
	if err := h.App.Store.DeleteFriendship(r.ctx, r.userID, otherID); err != nil {
		return internalError("delete friendship", err)
	}
	if f.Status == models.StatusAccepted {
		users, err := h.App.Store.GetUsers(r.ctx, []string{r.userID, otherID})
		if err != nil {
			return internalError("get users", err)
		}
		if me, other := users[r.userID], users[otherID]; me != nil && other != nil {
			if err := h.App.CleanupPair(r.ctx, me, other); err != nil {
				return internalError("cleanup nearby state", err)
			}
		}
	}
	return respond(200, map[string]string{"status": "removed"})
}

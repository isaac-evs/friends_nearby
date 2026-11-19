package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/isaac-evs/friends_nearby/backend/internal/auth"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

type resetRecord struct {
	User  string `json:"user"`
	Hash  string `json:"hash"`
	Until int64  `json:"until"`
	Used  bool   `json:"used"`
}

func resetHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func (h *Handler) forgotPassword(r *request) httpResp {
	var in struct {
		Email string `json:"email"`
	}
	if e := r.decode(&in); e != nil {
		return respond(400, errBody(e.Error()))
	}
	email := store.NormalizeEmail(in.Email)
	if a, e := mail.ParseAddress(email); e != nil || a.Address != email {
		return respond(400, errBody("invalid email"))
	}
	if h.App.Mailer == nil {
		return respond(503, errBody("password recovery is not configured"))
	}
	id, err := h.App.Store.UserIDByEmail(r.ctx, email)
	if err != nil {
		return internalError("reset lookup", err)
	}
	t := newSocialTx(h, r)
	key := resetHash(email)
	var old resetRecord
	if err = t.load("reset", key, &old); err != nil {
		return internalError("reset lookup", err)
	}
	if old.Until-time.Now().Unix() > 27*60 {
		return respond(202, map[string]bool{"accepted": true})
	}
	tokenBytes := make([]byte, 32)
	if _, err = rand.Read(tokenBytes); err != nil {
		return internalError("random reset token", err)
	}
	token := hex.EncodeToString(tokenBytes)
	record := resetRecord{User: id, Hash: resetHash(token), Until: time.Now().Add(30 * time.Minute).Unix()}
	if err = t.save("reset", key, record); err != nil {
		return internalError("save reset", err)
	}
	if err = t.commit(); err != nil {
		if errors.Is(err, store.ErrConflict) {
			return respond(202, map[string]bool{"accepted": true})
		}
		return internalError("save reset", err)
	}
	if id != "" {
		link := strings.TrimRight(h.App.Cfg.FrontendURL, "/") + "/entrar?reset=" + url.QueryEscape(key+"."+token)
		if err = h.App.Mailer.SendReset(r.ctx, email, link); err != nil {
			slog.Error("send password reset", "err", err)
		}
	}
	return respond(202, map[string]bool{"accepted": true})
}
func (h *Handler) resetPassword(r *request) httpResp {
	var in struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if e := r.decode(&in); e != nil {
		return respond(400, errBody(e.Error()))
	}
	parts := strings.Split(in.Token, ".")
	if len(parts) != 2 || len(parts[0]) != 64 || len(parts[1]) != 64 || len(in.Password) < 8 || len(in.Password) > 72 {
		return respond(400, errBody("invalid reset token or password"))
	}
	d, err := h.App.Store.GetDocument(r.ctx, "reset", parts[0])
	if err != nil {
		return internalError("get reset", err)
	}
	var rec resetRecord
	if len(d.Data) == 0 {
		return respond(400, errBody("reset token expired or invalid"))
	}
	if err = json.Unmarshal(d.Data, &rec); err != nil {
		return internalError("decode reset", err)
	}
	if rec.User == "" || rec.Used || rec.Until <= time.Now().Unix() || rec.Hash != resetHash(parts[1]) {
		return respond(400, errBody("reset token expired or invalid"))
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return internalError("hash password", err)
	}
	if err = h.App.Store.ResetPassword(r.ctx, d, rec.User, hash); err != nil {
		if errors.Is(err, store.ErrConflict) {
			return respond(400, errBody("reset token expired or invalid"))
		}
		return internalError("reset password", err)
	}
	return respond(200, map[string]bool{"ok": true})
}

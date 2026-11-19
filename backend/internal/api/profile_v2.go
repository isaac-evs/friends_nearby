package api

import (
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/isaac-evs/friends_nearby/backend/internal/auth"
	"strings"
	"time"
)

func validUsername(name string) bool {
	if len(name) < 3 || len(name) > 20 || strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".") || strings.Contains(name, "..") {
		return false
	}
	for _, c := range name {
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '_' || c == '.') {
			return false
		}
	}
	return !validChoice(name, "admin,jalas,soporte,ayuda,moderacion,moderador")
}
func (h *Handler) usernameAvailable(r *request, name string) httpResp {
	if !validUsername(name) {
		return respond(200, map[string]bool{"available": false})
	}
	id, e := h.App.Store.UserIDByUsername(r.ctx, name)
	if e != nil {
		return responseError(e)
	}
	return respond(200, map[string]bool{"available": id == "" || id == r.userID})
}
func (h *Handler) changePassword(r *request) httpResp {
	var in struct {
		Current string `json:"current"`
		Next    string `json:"next"`
	}
	if e := r.decode(&in); e != nil {
		return responseError(e)
	}
	if len(in.Next) < 8 || len(in.Next) > 72 || in.Next == in.Current {
		return respond(400, errBody("La contraseña nueva debe tener entre 8 y 72 bytes y ser distinta."))
	}
	lower, upper, digit := false, false, false
	for _, c := range in.Next {
		if c >= 'a' && c <= 'z' {
			lower = true
		}
		if c >= 'A' && c <= 'Z' {
			upper = true
		}
		if c >= '0' && c <= '9' {
			digit = true
		}
	}
	if !(lower || upper) || !digit {
		return respond(400, errBody("La contraseña debe incluir una letra y un número."))
	}
	u, e := h.App.Store.GetUser(r.ctx, r.userID)
	if e != nil {
		return responseError(e)
	}
	if u == nil || !auth.CheckPassword(u.PasswordHash, in.Current) {
		return respond(400, errBody("La contraseña actual no es correcta."))
	}
	hash, e := auth.HashPassword(in.Next)
	if e != nil {
		return responseError(e)
	}
	version, e := h.App.Store.ChangePassword(r.ctx, u.UserID, u.PasswordHash, hash)
	if e != nil {
		return responseError(e)
	}
	token, e := h.App.Auth.IssueSession(u.UserID, version)
	if e != nil {
		return responseError(e)
	}
	return respond(200, map[string]string{"token": token})
}
func (h *Handler) mediaPresign(r *request) httpResp {
	var in struct {
		Kind        string `json:"kind"`
		ContentType string `json:"content_type"`
		Size        int64  `json:"size"`
	}
	if e := r.decode(&in); e != nil {
		return responseError(e)
	}
	if !validChoice(in.Kind, "avatar,cover,plan,event") {
		return respond(400, errBody("Tipo de imagen no válido."))
	}
	ext, ok := photoTypes[in.ContentType]
	if !ok || in.Size < 1 || in.Size > 5*1024*1024 {
		return respond(400, errBody("La imagen debe ser JPG, PNG o WebP de hasta 5 MB."))
	}
	key := fmt.Sprintf("photos/%s/%s-%s.%s", r.userID, in.Kind, uuid.NewString(), ext)
	url, e := h.App.Presigner.PresignPut(r.ctx, key, in.ContentType, 5*time.Minute)
	if e != nil {
		return responseError(e)
	}
	t := newSocialTx(h, r)
	return respond(200, map[string]string{"uploadUrl": url, "publicUrl": t.mediaURL(key), "key": key})
}

// deleteAccount: borra tu cuenta (`POST /me/delete {password}`). Pide la contraseña. Antes de borrar la identidad:
// cancela los planes y eventos que organizabas y te saca de aquellos a los que ibas, sin penalizaciones. Es irreversible.
func (h *Handler) deleteAccount(r *request) httpResp {
	var in struct {
		Password string `json:"password"`
	}
	if e := r.decode(&in); e != nil {
		return responseError(e)
	}
	u, e := h.App.Store.GetUser(r.ctx, r.userID)
	if e != nil {
		return responseError(e)
	}
	if u == nil || !auth.CheckPassword(u.PasswordHash, in.Password) {
		return respond(400, errBody("La contraseña no es correcta."))
	}
	if e = h.leaveEverything(r, u.UserID); e != nil {
		return responseError(e)
	}
	if e = h.App.Store.DeleteAccount(r.ctx, u); e != nil {
		return responseError(e)
	}
	_ = h.App.Loc.Delete(r.ctx, u.UserID)
	_ = h.App.Loc.DeleteNear(r.ctx, u.UserID)
	return respond(200, map[string]bool{"deleted": true})
}

// leaveEverything: sus planes y eventos activos se cancelan y de los demás sale (un documento por transacción).
func (h *Handler) leaveEverything(r *request, id string) error {
	now := nowISO()
	plans, e := h.App.Store.ListDocuments(r.ctx, plansPK)
	if e != nil {
		return e
	}
	for _, d := range plans {
		var plan socialPlan
		if e = json.Unmarshal(d.Data, &plan); e != nil {
			return e
		}
		m, joined := plan.Members[id]
		if plan.ID == "" || plan.Canceled || !active(plan.Expires) || (plan.Author != id && !joined) {
			continue
		}
		if plan.Author == id {
			plan.Canceled, plan.CanceledAt = true, now
		} else if m.Status == "going" {
			m.Status, m.LeftAt = "left", now
			plan.Members[id] = m
			plan.Joined--
		}
		t := newSocialTx(h, r)
		if e = t.load(plansPK, plan.ID, &json.RawMessage{}); e != nil {
			return e
		}
		if e = t.save(plansPK, plan.ID, plan); e != nil {
			return e
		}
		if e = t.commit(); e != nil {
			return e
		}
	}
	events, e := h.App.Store.ListDocuments(r.ctx, eventsPK)
	if e != nil {
		return e
	}
	for _, d := range events {
		var ev socialEvent
		if e = json.Unmarshal(d.Data, &ev); e != nil {
			return e
		}
		m, joined := ev.Members[id]
		if ev.ID == "" || ev.Canceled || !active(ev.Ends) || (ev.Owner != id && !joined) {
			continue
		}
		if ev.Owner == id {
			ev.Canceled = true
		} else {
			if m.Status == "going" {
				ev.Going--
			}
			m.Status = "left"
			ev.Members[id] = m
		}
		t := newSocialTx(h, r)
		if e = t.load(eventsPK, ev.ID, &json.RawMessage{}); e != nil {
			return e
		}
		if e = t.save(eventsPK, ev.ID, ev); e != nil {
			return e
		}
		if e = t.commit(); e != nil {
			return e
		}
	}
	return nil
}

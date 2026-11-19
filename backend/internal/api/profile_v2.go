package api

import (
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

package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"

	"github.com/aws/aws-lambda-go/events"

	"github.com/isaac-evs/friends_nearby/backend/internal/app"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
)

type wsBody struct {
	Action string   `json:"action"`
	Lat    *float64 `json:"lat"`
	Lng    *float64 `json:"lng"`
}

func (h *Handler) handleWS(ctx context.Context, ev events.APIGatewayWebsocketProxyRequest) events.APIGatewayV2HTTPResponse {
	connID := ev.RequestContext.ConnectionID
	a := h.App

	switch ev.RequestContext.RouteKey {
	case "$connect":
		// The token travels in the query string because browsers cannot set
		// headers on a WebSocket handshake.
		userID, version, err := a.Auth.VerifySession(ev.QueryStringParameters["token"])
		if err != nil {
			return respond(401, errBody("unauthorized"))
		}
		u, err := a.Store.GetUser(ctx, userID)
		if err != nil {
			slog.Error("connect: get user", "err", err)
			return respond(500, errBody("internal error"))
		}
		if u == nil || u.SessionVersion != version {
			return respond(401, errBody("unauthorized"))
		}
		if err := a.Store.PutConnection(ctx, connID, userID, version); err != nil {
			slog.Error("connect: put connection", "err", err)
			return respond(500, errBody("internal error"))
		}
		return respond(200, map[string]string{"ok": "connected"})

	case "$disconnect":
		if err := a.Store.DeleteConnection(ctx, connID); err != nil {
			slog.Error("disconnect", "err", err)
		}
		return respond(200, map[string]string{"ok": "bye"})
	}

	// "location" and "$default" both land here; the body's action decides.
	conn, err := a.Store.GetConnection(ctx, connID)
	if err != nil {
		slog.Error("get connection", "err", err)
		return respond(500, errBody("internal error"))
	}
	if conn == nil {
		return respond(403, errBody("unknown connection"))
	}
	u, err := a.Store.GetUser(ctx, conn.UserID)
	if err != nil {
		return internalError("authenticate websocket", err)
	}
	if u == nil || u.SessionVersion != conn.SessionVersion {
		_ = a.Store.DeleteConnection(ctx, connID)
		return respond(403, errBody("session expired"))
	}

	var body wsBody
	if err := json.Unmarshal([]byte(ev.Body), &body); err != nil {
		a.PushToConnection(ctx, connID, app.Message{Type: app.MsgError, Error: "invalid JSON"})
		return respond(200, map[string]string{"ok": "ignored"})
	}

	switch body.Action {
	case "location":
		if body.Lat == nil || body.Lng == nil {
			a.PushToConnection(ctx, connID, app.Message{Type: app.MsgError, Error: "lat and lng are required"})
			break
		}
		err := a.HandleLocation(ctx, conn.UserID, models.Location{Lat: *body.Lat, Lng: *body.Lng})
		switch {
		case err == nil:
		case errors.Is(err, app.ErrGhostMode), errors.Is(err, app.ErrBadLocation):
			a.PushToConnection(ctx, connID, app.Message{Type: app.MsgError, Error: err.Error()})
		default:
			slog.Error("handle location", "user", conn.UserID, "err", err)
			a.PushToConnection(ctx, connID, app.Message{Type: app.MsgError, Error: "internal error"})
		}
	case "nearby":
		list, err := a.Snapshot(ctx, conn.UserID)
		if err != nil {
			slog.Error("snapshot", "user", conn.UserID, "err", err)
			a.PushToConnection(ctx, connID, app.Message{Type: app.MsgError, Error: "internal error"})
			break
		}
		a.PushToConnection(ctx, connID, app.Message{Type: app.MsgNearby, Nearby: &list})
	case "ping":
		a.PushToConnection(ctx, connID, app.Message{Type: app.MsgPong})
	default:
		a.PushToConnection(ctx, connID, app.Message{Type: app.MsgError, Error: "unknown action"})
	}
	return respond(200, map[string]string{"ok": "done"})
}

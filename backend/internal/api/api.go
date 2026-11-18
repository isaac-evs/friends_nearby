// Package api is the Lambda entry point logic. One function serves both the HTTP
// API and the WebSocket API, so Handle inspects the event to decide which.
package api

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/aws/aws-lambda-go/events"

	"github.com/isaac-evs/friends_nearby/backend/internal/app"
)

type Handler struct {
	App *app.App
}

type probe struct {
	RequestContext struct {
		ConnectionID string `json:"connectionId"`
	} `json:"requestContext"`
}

// Handle is the function registered with lambda.Start. The return value is
// valid for both integrations: HTTP API v2 and WebSocket proxy responses share
// the statusCode/headers/body shape.
func (h *Handler) Handle(ctx context.Context, raw json.RawMessage) (events.APIGatewayV2HTTPResponse, error) {
	var p probe
	if err := json.Unmarshal(raw, &p); err != nil {
		return respond(400, errBody("invalid event")), nil
	}
	if p.RequestContext.ConnectionID != "" {
		var ev events.APIGatewayWebsocketProxyRequest
		if err := json.Unmarshal(raw, &ev); err != nil {
			return respond(400, errBody("invalid event")), nil
		}
		return h.handleWS(ctx, ev), nil
	}
	var ev events.APIGatewayV2HTTPRequest
	if err := json.Unmarshal(raw, &ev); err != nil {
		return respond(400, errBody("invalid event")), nil
	}
	return h.handleHTTP(ctx, ev), nil
}

func respond(status int, body any) events.APIGatewayV2HTTPResponse {
	b, err := json.Marshal(body)
	if err != nil {
		slog.Error("marshal response", "err", err)
		status, b = 500, []byte(`{"error":"internal error"}`)
	}
	return events.APIGatewayV2HTTPResponse{
		StatusCode: status,
		Headers:    map[string]string{"content-type": "application/json"},
		Body:       string(b),
	}
}

func errBody(msg string) map[string]string { return map[string]string{"error": msg} }

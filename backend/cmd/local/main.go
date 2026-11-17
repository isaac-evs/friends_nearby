// Command local runs the same handlers as the Lambdas on your machine.
//
//	HTTP  -> http://localhost:8080/...        (translated to an HTTP API v2 event)
//	WS    -> ws://localhost:8080/ws?token=... (translated to WebSocket events)
//
// It needs DynamoDB Local and Redis (docker compose up -d). SQS and S3 history
// are replaced by an in-process queue and files under .local/history.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/isaac-evs/friends_nearby/backend/internal/api"
	"github.com/isaac-evs/friends_nearby/backend/internal/app"
	"github.com/isaac-evs/friends_nearby/backend/internal/auth"
	"github.com/isaac-evs/friends_nearby/backend/internal/awsadapters"
	"github.com/isaac-evs/friends_nearby/backend/internal/config"
	"github.com/isaac-evs/friends_nearby/backend/internal/location"
	"github.com/isaac-evs/friends_nearby/backend/internal/ports"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
	"github.com/isaac-evs/friends_nearby/backend/internal/worker"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	setDefaults()
	cfg, err := config.Load("USERS_TABLE", "FRIENDSHIPS_TABLE", "CONNECTIONS_TABLE", "REDIS_HOST", "JWT_SECRET")
	if err != nil {
		fatal("config", err)
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		fatal("aws config", err)
	}
	db := dynamodb.NewFromConfig(awsCfg, func(o *dynamodb.Options) { o.BaseEndpoint = aws.String(cfg.DynamoEndpoint) })
	if err := store.EnsureTables(ctx, db, cfg); err != nil {
		fatal("create tables (is `docker compose up -d` running?)", err)
	}

	rdb := location.NewClient(cfg)
	if err := rdb.Ping(ctx).Err(); err != nil {
		fatal("redis (is `docker compose up -d` running?)", err)
	}

	hub := newHub()
	queue := newLocalQueue(&worker.Handler{Sink: fileSink{dir: ".local/history"}})
	go queue.run(ctx)

	handler := &api.Handler{App: &app.App{
		Cfg:       cfg,
		Auth:      auth.New(cfg.JWTSecret, cfg.JWTTTL),
		Store:     store.New(db, cfg),
		Loc:       location.New(rdb, cfg.LocationTTL),
		Pusher:    hub,
		Queue:     queue,
		Presigner: awsadapters.NewS3(awsCfg, cfg.MediaBucket, ""),
	}}

	srv := &http.Server{Addr: ":8080", Handler: &server{h: handler, hub: hub}}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()
	slog.Info("local backend listening", "http", "http://localhost:8080", "ws", "ws://localhost:8080/ws?token=<jwt>")
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fatal("server", err)
	}
}

func fatal(msg string, err error) {
	slog.Error(msg, "err", err)
	os.Exit(1)
}

// setDefaults fills in local values without overriding anything already set.
func setDefaults() {
	defaults := map[string]string{
		"USERS_TABLE":           "friends-nearby-local-users",
		"FRIENDSHIPS_TABLE":     "friends-nearby-local-friendships",
		"CONNECTIONS_TABLE":     "friends-nearby-local-connections",
		"REDIS_HOST":            "localhost",
		"REDIS_PORT":            "6379",
		"REDIS_TLS":             "false",
		"DYNAMODB_ENDPOINT":     "http://localhost:8000",
		"MEDIA_BUCKET":          "friends-nearby-local-media",
		"CDN_DOMAIN":            "cdn.local",
		"JWT_SECRET":            "local-dev-secret-change-me",
		"AWS_REGION":            "us-east-1",
		"AWS_ACCESS_KEY_ID":     "local",
		"AWS_SECRET_ACCESS_KEY": "local",
	}
	for k, v := range defaults {
		if os.Getenv(k) == "" {
			os.Setenv(k, v)
		}
	}
}

// ---------------------------------------------------------------- HTTP + WS

type server struct {
	h   *api.Handler
	hub *hub
}

var upgrader = websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Permissive CORS, local development only (the real API uses API Gateway's).
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "authorization, content-type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.URL.Path == "/ws" {
		s.serveWS(w, r)
		return
	}
	s.serveREST(w, r)
}

func (s *server) serveREST(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	headers := map[string]string{}
	for k, v := range r.Header {
		headers[strings.ToLower(k)] = strings.Join(v, ",")
	}
	query := map[string]string{}
	for k, v := range r.URL.Query() {
		query[k] = v[0]
	}
	ev := events.APIGatewayV2HTTPRequest{
		Version:               "2.0",
		RawPath:               r.URL.Path,
		RawQueryString:        r.URL.RawQuery,
		Headers:               headers,
		QueryStringParameters: query,
		Body:                  string(body),
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{Method: r.Method, Path: r.URL.Path},
		},
	}
	resp, err := invoke[events.APIGatewayV2HTTPResponse](r.Context(), s.h, ev)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	for k, v := range resp.Headers {
		w.Header().Set(k, v)
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.WriteString(w, resp.Body)
	slog.Info("http", "method", r.Method, "path", r.URL.Path, "status", resp.StatusCode)
}

func (s *server) serveWS(w http.ResponseWriter, r *http.Request) {
	connID := uuid.NewString()
	query := map[string]string{}
	for k, v := range r.URL.Query() {
		query[k] = v[0]
	}
	// $connect runs before the upgrade, like API Gateway: a non-200 refuses the handshake.
	resp, err := invoke[events.APIGatewayV2HTTPResponse](r.Context(), s.h, wsEvent(connID, "$connect", "", query))
	if err != nil || resp.StatusCode != http.StatusOK {
		code := resp.StatusCode
		if code == 0 {
			code = http.StatusInternalServerError
		}
		http.Error(w, resp.Body, code)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		_, _ = invoke[events.APIGatewayV2HTTPResponse](context.Background(), s.h, wsEvent(connID, "$disconnect", "", nil))
		return
	}
	s.hub.add(connID, conn)
	slog.Info("ws connected", "conn", connID)
	defer func() {
		s.hub.remove(connID)
		_ = conn.Close()
		_, _ = invoke[events.APIGatewayV2HTTPResponse](context.Background(), s.h, wsEvent(connID, "$disconnect", "", nil))
		slog.Info("ws disconnected", "conn", connID)
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return
		}
		var probe struct {
			Action string `json:"action"`
		}
		_ = json.Unmarshal(msg, &probe)
		route := "$default"
		if probe.Action == "location" { // the real API selects on $request.body.action
			route = "location"
		}
		if _, err := invoke[events.APIGatewayV2HTTPResponse](r.Context(), s.h, wsEvent(connID, route, string(msg), nil)); err != nil {
			slog.Error("ws handler", "err", err)
		}
	}
}

func wsEvent(connID, route, body string, query map[string]string) events.APIGatewayWebsocketProxyRequest {
	return events.APIGatewayWebsocketProxyRequest{
		QueryStringParameters: query,
		Body:                  body,
		RequestContext: events.APIGatewayWebsocketProxyRequestContext{
			ConnectionID: connID,
			RouteKey:     route,
		},
	}
}

// invoke marshals ev to JSON and calls the real Lambda handler entry point.
func invoke[T any](ctx context.Context, h *api.Handler, ev any) (T, error) {
	var zero T
	raw, err := json.Marshal(ev)
	if err != nil {
		return zero, err
	}
	resp, err := h.Handle(ctx, raw)
	if err != nil {
		return zero, err
	}
	b, err := json.Marshal(resp)
	if err != nil {
		return zero, err
	}
	var out T
	return out, json.Unmarshal(b, &out)
}

// ---------------------------------------------------------------- hub (Pusher)

type wsConn struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

type hub struct {
	mu    sync.RWMutex
	conns map[string]*wsConn
}

func newHub() *hub { return &hub{conns: map[string]*wsConn{}} }

func (h *hub) add(id string, c *websocket.Conn) {
	h.mu.Lock()
	h.conns[id] = &wsConn{conn: c}
	h.mu.Unlock()
}

func (h *hub) remove(id string) {
	h.mu.Lock()
	delete(h.conns, id)
	h.mu.Unlock()
}

// Push mimics API Gateway's postToConnection.
func (h *hub) Push(_ context.Context, connectionID string, payload []byte) error {
	h.mu.RLock()
	c := h.conns[connectionID]
	h.mu.RUnlock()
	if c == nil {
		return ports.ErrGone
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if err := c.conn.WriteMessage(websocket.TextMessage, payload); err != nil {
		return ports.ErrGone
	}
	return nil
}

// ---------------------------------------------------------------- queue + sink

// localQueue replaces SQS: it batches messages and feeds them to the worker
// handler the same way the event source mapping does (up to 100 messages or 5s).
type localQueue struct {
	ch chan string
	w  *worker.Handler
}

func newLocalQueue(w *worker.Handler) *localQueue {
	return &localQueue{ch: make(chan string, 1000), w: w}
}

func (q *localQueue) Send(_ context.Context, body []byte) error {
	select {
	case q.ch <- string(body):
		return nil
	default:
		return errors.New("local queue full")
	}
}

func (q *localQueue) run(ctx context.Context) {
	tick := time.NewTicker(5 * time.Second)
	defer tick.Stop()
	var batch []events.SQSMessage
	flush := func() {
		if len(batch) == 0 {
			return
		}
		resp, err := q.w.Handle(context.Background(), events.SQSEvent{Records: batch})
		if err != nil || len(resp.BatchItemFailures) > 0 {
			slog.Error("local worker batch failed", "err", err, "failures", len(resp.BatchItemFailures))
		}
		batch = nil
	}
	for {
		select {
		case <-ctx.Done():
			flush()
			return
		case body := <-q.ch:
			batch = append(batch, events.SQSMessage{MessageId: uuid.NewString(), Body: body})
			if len(batch) >= 100 {
				flush()
			}
		case <-tick.C:
			flush()
		}
	}
}

// fileSink replaces S3 for the worker.
type fileSink struct{ dir string }

func (f fileSink) Put(_ context.Context, key string, body []byte) error {
	path := filepath.Join(f.dir, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	slog.Info("history batch written", "file", path, "lines", bytes.Count(body, []byte("\n")))
	return os.WriteFile(path, body, 0o644)
}

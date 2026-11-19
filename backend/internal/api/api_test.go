package api_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"

	"github.com/isaac-evs/friends_nearby/backend/internal/app"
	"github.com/isaac-evs/friends_nearby/backend/internal/testenv"
)

type client struct {
	t *testing.T
	e *testenv.Env
}

// do sends an HTTP API v2 event through the real Lambda entry point.
func (c *client) do(method, path, token string, body any) (int, map[string]any) {
	c.t.Helper()
	ev := events.APIGatewayV2HTTPRequest{
		RawPath: path,
		Headers: map[string]string{},
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{Method: method, Path: path},
		},
	}
	if i := strings.Index(path, "?"); i >= 0 {
		ev.RawPath = path[:i]
		ev.QueryStringParameters = map[string]string{}
		for _, kv := range strings.Split(path[i+1:], "&") {
			p := strings.SplitN(kv, "=", 2)
			ev.QueryStringParameters[p[0]] = p[1]
		}
	}
	if token != "" {
		ev.Headers["authorization"] = "Bearer " + token
	}
	if body != nil {
		b, _ := json.Marshal(body)
		ev.Body = string(b)
	}
	return c.invoke(ev)
}

func (c *client) invoke(ev any) (int, map[string]any) {
	c.t.Helper()
	raw, _ := json.Marshal(ev)
	resp, err := c.e.Handler.Handle(context.Background(), raw)
	if err != nil {
		c.t.Fatalf("handler error: %v", err)
	}
	var out map[string]any
	_ = json.Unmarshal([]byte(resp.Body), &out)
	return resp.StatusCode, out
}

func (c *client) ws(route, connID, body string, query map[string]string) (int, map[string]any) {
	c.t.Helper()
	return c.invoke(events.APIGatewayWebsocketProxyRequest{
		Body:                  body,
		QueryStringParameters: query,
		RequestContext:        events.APIGatewayWebsocketProxyRequestContext{ConnectionID: connID, RouteKey: route},
	})
}

func (c *client) register(name string) (token, id string) {
	c.t.Helper()
	code, out := c.do("POST", "/auth/register", "", map[string]string{
		"email": name + "@example.com", "username": name, "password": "password123",
	})
	if code != 201 {
		c.t.Fatalf("register %s: %d %v", name, code, out)
	}
	return out["token"].(string), out["user"].(map[string]any)["user_id"].(string)
}

func newClient(t *testing.T) *client { return &client{t: t, e: testenv.New(t)} }

func want(t *testing.T, label string, got, expected int) {
	t.Helper()
	if got != expected {
		t.Errorf("%s: status %d, want %d", label, got, expected)
	}
}

func TestRegisterValidation(t *testing.T) {
	c := newClient(t)
	ok := map[string]string{"email": "ana@example.com", "username": "ana", "password": "password123"}
	with := func(k, v string) map[string]string {
		m := map[string]string{}
		for kk, vv := range ok {
			m[kk] = vv
		}
		m[k] = v
		return m
	}
	bad := map[string]map[string]string{
		"email without @":    with("email", "ana.example.com"),
		"email with name":    with("email", "Ana <ana@example.com>"),
		"empty email":        with("email", ""),
		"short username":     with("username", "ab"),
		"long username":      with("username", strings.Repeat("a", 21)),
		"username with dash": with("username", "ana-b"),
		"username with @":    with("username", "@ana"),
		"short password":     with("password", "1234567"),
		"long password":      with("password", strings.Repeat("p", 73)),
	}
	for name, body := range bad {
		code, _ := c.do("POST", "/auth/register", "", body)
		want(t, name, code, 400)
	}
	code, _ := c.do("POST", "/auth/register", "", "not an object")
	want(t, "non-object JSON", code, 400)

	code, out := c.do("POST", "/auth/register", "", ok)
	want(t, "valid registration", code, 201)
	user := out["user"].(map[string]any)
	if _, leaked := user["password_hash"]; leaked {
		t.Error("response leaks password_hash")
	}
	if user["radius_m"] != float64(500) || user["ghost_mode"] != false || user["display_name"] != "ana" {
		t.Errorf("unexpected defaults: %v", user)
	}

	// Usernames and emails are case-insensitive.
	code, _ = c.do("POST", "/auth/register", "", map[string]string{"email": "ANA@example.com", "username": "someoneelse", "password": "password123"})
	want(t, "duplicate email, different case", code, 409)
	code, _ = c.do("POST", "/auth/register", "", map[string]string{"email": "new@example.com", "username": "Ana", "password": "password123"})
	want(t, "duplicate username, different case", code, 409)
}

func TestLogin(t *testing.T) {
	c := newClient(t)
	c.register("ana")

	code, out := c.do("POST", "/auth/login", "", map[string]string{"email": "Ana@Example.com", "password": "password123"})
	want(t, "login (case-insensitive email)", code, 200)
	if out["token"] == nil {
		t.Error("no token returned")
	}
	code, wrongPass := c.do("POST", "/auth/login", "", map[string]string{"email": "ana@example.com", "password": "nope-nope-1"})
	want(t, "wrong password", code, 401)
	code, unknown := c.do("POST", "/auth/login", "", map[string]string{"email": "ghost@example.com", "password": "password123"})
	want(t, "unknown email", code, 401)
	if wrongPass["error"] != unknown["error"] {
		t.Error("login must not reveal whether an email exists")
	}
}

func TestAuthRequired(t *testing.T) {
	c := newClient(t)
	token, _ := c.register("ana")
	routes := [][2]string{
		{"GET", "/me"}, {"PATCH", "/me"}, {"GET", "/friends"}, {"GET", "/nearby"},
		{"POST", "/friends/requests"}, {"GET", "/users/search?username=ana"}, {"POST", "/me/photo-upload-url"},
	}
	for _, r := range routes {
		code, _ := c.do(r[0], r[1], "", nil)
		want(t, r[0]+" "+r[1]+" without token", code, 401)
		code, _ = c.do(r[0], r[1], "garbage", nil)
		want(t, r[0]+" "+r[1]+" with bad token", code, 401)
	}
	code, _ := c.do("GET", "/me", token, nil)
	want(t, "GET /me with token", code, 200)
	code, _ = c.do("GET", "/nope", token, nil)
	want(t, "unknown route", code, 404)
}

func TestProfileUpdates(t *testing.T) {
	c := newClient(t)
	token, id := c.register("ana")

	for _, r := range []int{0, 99, 5001, -5} {
		code, _ := c.do("PATCH", "/me", token, map[string]any{"radius_m": r})
		want(t, "radius out of range", code, 400)
	}
	for _, r := range []int{100, 5000} {
		code, out := c.do("PATCH", "/me", token, map[string]any{"radius_m": r})
		want(t, "radius at limit", code, 200)
		if out["radius_m"] != float64(r) {
			t.Errorf("radius = %v, want %d", out["radius_m"], r)
		}
	}
	code, _ := c.do("PATCH", "/me", token, map[string]any{"display_name": "   "})
	want(t, "blank display name", code, 400)
	code, _ = c.do("PATCH", "/me", token, map[string]any{"display_name": strings.Repeat("x", 51)})
	want(t, "long display name", code, 400)
	code, out := c.do("PATCH", "/me", token, map[string]any{"display_name": "  Ana María "})
	want(t, "valid display name", code, 200)
	if out["display_name"] != "Ana María" {
		t.Errorf("display_name = %q", out["display_name"])
	}

	// Photos: the key must belong to the caller.
	code, _ = c.do("PATCH", "/me", token, map[string]any{"photo_key": "photos/someone-else/a.png"})
	want(t, "someone else's photo key", code, 400)
	code, _ = c.do("PATCH", "/me", token, map[string]any{"photo_key": "../etc/passwd"})
	want(t, "arbitrary photo key", code, 400)
	code, out = c.do("POST", "/me/photo-upload-url", token, map[string]string{"content_type": "image/png"})
	want(t, "upload url", code, 200)
	key := out["key"].(string)
	if !strings.HasPrefix(key, "photos/"+id+"/") || !strings.HasSuffix(key, ".png") {
		t.Errorf("unexpected key %q", key)
	}
	code, _ = c.do("POST", "/me/photo-upload-url", token, map[string]string{"content_type": "text/html"})
	want(t, "non-image upload", code, 400)
	code, out = c.do("PATCH", "/me", token, map[string]any{"photo_key": key})
	want(t, "own photo key", code, 200)
	if out["photo_key"] != key {
		t.Errorf("photo_key = %v", out["photo_key"])
	}
}

func TestFriendRequestFlows(t *testing.T) {
	c := newClient(t)
	ta, ia := c.register("ana")
	tb, ib := c.register("bob")
	tc, _ := c.register("cara")

	code, _ := c.do("POST", "/friends/requests", ta, map[string]string{"username": "ana"})
	want(t, "add yourself", code, 400)
	code, _ = c.do("POST", "/friends/requests", ta, map[string]string{"username": "nobody"})
	want(t, "unknown user", code, 404)
	code, _ = c.do("GET", "/users/search?username=bob", ta, nil)
	want(t, "search existing", code, 200)
	code, _ = c.do("GET", "/users/search?username=nobody", ta, nil)
	want(t, "search missing", code, 404)
	code, _ = c.do("GET", "/users/search", ta, nil)
	want(t, "search without username", code, 400)

	code, _ = c.do("POST", "/friends/requests", ta, map[string]string{"username": "Bob"})
	want(t, "request (username is case-insensitive)", code, 201)
	code, _ = c.do("POST", "/friends/requests", ta, map[string]string{"username": "bob"})
	want(t, "request twice", code, 409)

	_, out := c.do("GET", "/friends", ta, nil)
	if len(out["outgoing"].([]any)) != 1 || len(out["friends"].([]any)) != 0 {
		t.Errorf("ana's lists: %v", out)
	}
	_, out = c.do("GET", "/friends", tb, nil)
	if len(out["incoming"].([]any)) != 1 {
		t.Errorf("bob's lists: %v", out)
	}

	code, _ = c.do("POST", "/friends/"+ib+"/accept", ta, nil)
	want(t, "sender accepting own request", code, 404)
	code, _ = c.do("POST", "/friends/"+ia+"/accept", tc, nil)
	want(t, "third party accepting", code, 404)
	code, _ = c.do("POST", "/friends/"+ia+"/accept", tb, nil)
	want(t, "receiver accepting", code, 200)
	_, out = c.do("GET", "/friends", ta, nil)
	if len(out["friends"].([]any)) != 1 {
		t.Errorf("ana should have bob as a friend: %v", out)
	}

	code, _ = c.do("DELETE", "/friends/"+ib, ta, nil)
	want(t, "unfriend", code, 200)
	code, _ = c.do("DELETE", "/friends/"+ib, ta, nil)
	want(t, "unfriend again", code, 404)
	_, out = c.do("GET", "/friends", tb, nil)
	if len(out["friends"].([]any)) != 0 {
		t.Errorf("bob should have no friends after unfriend: %v", out)
	}
}

func TestCrossRequestsAutoAccept(t *testing.T) {
	c := newClient(t)
	ta, _ := c.register("ana")
	tb, _ := c.register("bob")
	c.do("POST", "/friends/requests", ta, map[string]string{"username": "bob"})
	code, out := c.do("POST", "/friends/requests", tb, map[string]string{"username": "ana"})
	want(t, "requesting someone who already asked you", code, 200)
	if out["status"] != "accepted" {
		t.Errorf("status = %v", out["status"])
	}
	_, lists := c.do("GET", "/friends", ta, nil)
	if len(lists["friends"].([]any)) != 1 {
		t.Errorf("they should be friends: %v", lists)
	}
}

func TestDeclineAndCancel(t *testing.T) {
	c := newClient(t)
	ta, ia := c.register("ana")
	tb, ib := c.register("bob")
	c.do("POST", "/friends/requests", ta, map[string]string{"username": "bob"})

	code, _ := c.do("DELETE", "/friends/"+ia, tb, nil)
	want(t, "decline", code, 200)
	_, lists := c.do("GET", "/friends", ta, nil)
	if len(lists["outgoing"].([]any)) != 0 {
		t.Errorf("declined request still listed: %v", lists)
	}

	c.do("POST", "/friends/requests", ta, map[string]string{"username": "bob"})
	code, _ = c.do("DELETE", "/friends/"+ib, ta, nil)
	want(t, "cancel", code, 200)
	code, _ = c.do("POST", "/friends/requests", ta, map[string]string{"username": "bob"})
	want(t, "request again after cancel", code, 201)
}

func TestWebSocketRoutes(t *testing.T) {
	c := newClient(t)
	token, id := c.register("ana")
	conn := "conn-1"

	code, _ := c.ws("$connect", conn, "", map[string]string{"token": "bad"})
	want(t, "connect with bad token", code, 401)
	code, _ = c.ws("$connect", conn, "", nil)
	want(t, "connect without token", code, 401)
	code, _ = c.ws("$connect", conn, "", map[string]string{"token": token})
	want(t, "connect", code, 200)
	if got, _ := c.e.Store.GetConnection(context.Background(), conn); got == nil || got.UserID != id {
		t.Fatalf("connection not stored: %+v", got)
	}
	if got, _ := c.e.Store.GetConnection(context.Background(), conn); got.ExpiresAt <= time.Now().Unix() {
		t.Error("connection expires_at must be in the future")
	}

	reply := func(connID string) []app.Message { return c.e.Pusher.Messages(connID) }

	code, _ = c.ws("location", "unknown-conn", `{"action":"location","lat":1,"lng":1}`, nil)
	want(t, "message from an unregistered connection", code, 403)

	c.ws("$default", conn, `{"action":"ping"}`, nil)
	c.ws("$default", conn, `{"action":"dance"}`, nil)
	c.ws("$default", conn, `not json`, nil)
	c.ws("location", conn, `{"action":"location","lat":123,"lng":0}`, nil)
	c.ws("$default", conn, `{"action":"nearby"}`, nil)
	types := []string{}
	for _, m := range reply(conn) {
		types = append(types, m.Type)
	}
	if got, exp := strings.Join(types, ","), "pong,error,error,error,nearby"; got != exp {
		t.Errorf("replies = %s, want %s", got, exp)
	}
	if last := reply(conn)[4]; last.Nearby == nil || len(*last.Nearby) != 0 {
		t.Errorf("empty snapshot must serialize as an empty list, got %+v", last.Nearby)
	}

	// A valid location is accepted silently (no friends nearby).
	c.e.Pusher.Reset()
	c.ws("location", conn, `{"action":"location","lat":19.43,"lng":-99.13}`, nil)
	if len(reply(conn)) != 0 {
		t.Errorf("valid location should not reply: %+v", reply(conn))
	}

	code, _ = c.ws("$disconnect", conn, "", nil)
	want(t, "disconnect", code, 200)
	if got, _ := c.e.Store.GetConnection(context.Background(), conn); got != nil {
		t.Error("connection should be deleted on disconnect")
	}
}

func TestGhostModeThroughTheAPI(t *testing.T) {
	c := newClient(t)
	ta, _ := c.register("ana")
	tb, bid := c.register("bob")
	c.do("POST", "/friends/requests", ta, map[string]string{"username": "bob"})
	_, lists := c.do("GET", "/friends", tb, nil)
	incoming := lists["incoming"].([]any)[0].(map[string]any)["user_id"].(string)
	c.do("POST", "/friends/"+incoming+"/accept", tb, nil)

	action(c, ta, map[string]any{"type": "requestClose", "userId": bid})
	action(c, tb, map[string]any{"type": "acceptClose", "userId": incoming})
	c.ws("$connect", "ca", "", map[string]string{"token": ta})
	c.ws("$connect", "cb", "", map[string]string{"token": tb})
	c.ws("location", "ca", `{"action":"location","lat":19.4326,"lng":-99.1332}`, nil)
	c.ws("location", "cb", `{"action":"location","lat":19.4328,"lng":-99.1332}`, nil)
	if n := len(c.e.Pusher.Messages("cb")); n != 1 {
		t.Fatalf("bob should have seen ana enter, messages: %+v", c.e.Pusher.Messages("cb"))
	}

	code, out := c.do("PATCH", "/me", ta, map[string]any{"ghost_mode": true})
	want(t, "ghost on", code, 200)
	if out["ghost_mode"] != true {
		t.Errorf("ghost_mode = %v", out["ghost_mode"])
	}
	msgs := c.e.Pusher.Messages("cb")
	if len(msgs) != 2 || msgs[1].Type != app.MsgFriendLeave {
		t.Errorf("bob should be told ana left: %+v", msgs)
	}
	// Updating something else while already in ghost mode must not re-announce.
	c.e.Pusher.Reset()
	c.do("PATCH", "/me", ta, map[string]any{"ghost_mode": true, "display_name": "Ana"})
	if n := len(c.e.Pusher.Messages("cb")); n != 0 {
		t.Errorf("repeating ghost mode sent %d messages", n)
	}
}

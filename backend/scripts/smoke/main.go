// Command smoke exercises a running `go run ./cmd/local` end to end:
// register, friends, WebSocket enter/leave, ghost mode, unfriend.
//
//	go run ./scripts/smoke [-base http://localhost:8080]
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var (
	base   = flag.String("base", "http://localhost:8080", "base URL of the local runner")
	failed = 0
)

func check(name string, ok bool, detail ...any) {
	if ok {
		fmt.Println("PASS", name)
		return
	}
	failed++
	fmt.Println("FAIL", name, fmt.Sprint(detail...))
}

type user struct {
	name, token, id string
	ws              *websocket.Conn
	msgs            chan map[string]any
}

func call(method, path, token string, body any) (int, map[string]any) {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, *base+path, rd)
	req.Header.Set("content-type", "application/json")
	if token != "" {
		req.Header.Set("authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("request error:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func register(name string) *user {
	code, out := call("POST", "/auth/register", "", map[string]string{
		"email": name + "@example.com", "username": name, "password": "password123",
	})
	check("register "+name, code == 201, code, out)
	u := &user{name: name, msgs: make(chan map[string]any, 50)}
	u.token, _ = out["token"].(string)
	if m, ok := out["user"].(map[string]any); ok {
		u.id, _ = m["user_id"].(string)
	}
	return u
}

func (u *user) connect() {
	wsURL := "ws" + strings.TrimPrefix(*base, "http") + "/ws?token=" + url.QueryEscape(u.token)
	c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	check("ws connect "+u.name, err == nil, err)
	if err != nil {
		return
	}
	u.ws = c
	go func() {
		for {
			_, b, err := c.ReadMessage()
			if err != nil {
				return
			}
			var m map[string]any
			if json.Unmarshal(b, &m) == nil {
				u.msgs <- m
			}
		}
	}()
}

func (u *user) send(v any) { _ = u.ws.WriteJSON(v) }

func (u *user) loc(lat, lng float64) {
	u.send(map[string]any{"action": "location", "lat": lat, "lng": lng})
}

// expect waits for a message of the given type about friend (username).
func (u *user) expect(label, typ, friend string) map[string]any {
	deadline := time.After(3 * time.Second)
	for {
		select {
		case m := <-u.msgs:
			f, _ := m["friend"].(map[string]any)
			if m["type"] == typ && (friend == "" || (f != nil && f["username"] == friend)) {
				check(label, true)
				return m
			}
		case <-deadline:
			check(label, false, "timed out waiting for "+typ)
			return nil
		}
	}
}

// expectNothing asserts no message of the type arrives shortly.
func (u *user) expectNothing(label, typ string) {
	deadline := time.After(600 * time.Millisecond)
	for {
		select {
		case m := <-u.msgs:
			if m["type"] == typ {
				check(label, false, m)
				return
			}
		case <-deadline:
			check(label, true)
			return
		}
	}
}

func main() {
	flag.Parse()
	sfx := fmt.Sprint(time.Now().UnixNano() % 1000000)
	ana, bob := register("ana"+sfx), register("bob"+sfx)

	code, _ := call("POST", "/auth/register", "", map[string]string{"email": ana.name + "@example.com", "username": "other" + sfx, "password": "password123"})
	check("duplicate email -> 409", code == 409, code)
	code, _ = call("POST", "/auth/register", "", map[string]string{"email": "x" + sfx + "@example.com", "username": ana.name, "password": "password123"})
	check("duplicate username -> 409", code == 409, code)
	code, out := call("POST", "/auth/login", "", map[string]string{"email": ana.name + "@example.com", "password": "password123"})
	check("login", code == 200 && out["token"] != nil, code, out)
	code, _ = call("POST", "/auth/login", "", map[string]string{"email": ana.name + "@example.com", "password": "wrongpass1"})
	check("wrong password -> 401", code == 401, code)
	code, _ = call("GET", "/me", "", nil)
	check("no token -> 401", code == 401, code)

	_, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(*base, "http")+"/ws?token=bad", nil)
	check("ws bad token refused", err != nil)

	ana.connect()
	bob.connect()
	if ana.ws == nil || bob.ws == nil {
		os.Exit(1)
	}

	// Friends
	code, _ = call("POST", "/friends/requests", ana.token, map[string]string{"username": bob.name})
	check("send friend request", code == 201, code)
	bob.expect("bob notified of request", "friend_request", ana.name)
	code, _ = call("POST", "/friends/requests", ana.token, map[string]string{"username": bob.name})
	check("duplicate request -> 409", code == 409, code)
	code, _ = call("POST", "/friends/"+bob.id+"/accept", ana.token, nil)
	check("sender cannot accept -> 404", code == 404, code)
	code, _ = call("POST", "/friends/"+ana.id+"/accept", bob.token, nil)
	check("accept", code == 200, code)
	ana.expect("ana notified of accept", "friend_accepted", bob.name)
	code, out = call("GET", "/friends", ana.token, nil)
	check("friends list has bob", code == 200 && len(out["friends"].([]any)) == 1, out)

	// Normal friendship does not authorize live presence.
	ana.loc(19.4326, -99.1332)
	bob.loc(19.4326, -99.1332)
	ana.expectNothing("normal friendship hides presence", "friend_enter")
	for _, step := range []struct {
		actor        *user
		kind, target string
	}{{ana, "requestClose", bob.id}, {bob, "acceptClose", ana.id}} {
		code, out = call("POST", "/app/actions", step.actor.token, map[string]any{"type": step.kind, "userId": step.target, "requestId": uuid.NewString()})
		check(step.kind, code == 200, code, out)
	}
	// Enter / leave
	const lat, lng = 19.4326, -99.1332
	ana.loc(lat, lng)
	bob.loc(lat+0.0009, lng) // about 100 m north
	ana.expect("ana sees bob enter", "friend_enter", bob.name)
	bob.expect("bob sees ana enter", "friend_enter", ana.name)
	ana.loc(lat, lng+0.0001)
	ana.expectNothing("no repeat enter while staying near", "friend_enter")

	bob.loc(lat+0.05, lng) // about 5.5 km away
	ana.expect("ana sees bob leave", "friend_leave", bob.name)
	bob.expect("bob sees ana leave", "friend_leave", ana.name)

	// Snapshot + radius preference
	bob.loc(lat+0.0009, lng)
	ana.expect("ana sees bob enter again", "friend_enter", bob.name)
	bob.expect("bob sees ana enter again", "friend_enter", ana.name)
	ana.send(map[string]string{"action": "nearby"})
	m := ana.expect("snapshot reply", "nearby", "")
	list, _ := m["nearby"].([]any)
	check("snapshot lists bob", len(list) == 1, m)

	code, _ = call("PATCH", "/me", bob.token, map[string]any{"radius_m": 10})
	check("radius below minimum -> 400", code == 400, code)
	code, _ = call("POST", "/app/actions", bob.token, map[string]any{"type": "setRadius", "radiusM": 1000, "requestId": uuid.NewString()})
	check("set search radius 1000", code == 200, code)
	bob.loc(lat+0.014, lng) // ~165 m: outside bob's 100 m radius, inside ana's 500 m
	bob.expect("bob sees ana leave (own radius)", "friend_leave", ana.name)
	ana.expectNothing("ana (5000 m search) still sees bob", "friend_leave")

	// Ghost mode
	bob.loc(lat, lng) // ~67 m
	bob.expect("bob sees ana enter (back in range)", "friend_enter", ana.name)
	code, out = call("PATCH", "/me", ana.token, map[string]any{"ghost_mode": true})
	check("ghost on", code == 200 && out["ghost_mode"] == true, code, out)
	bob.expect("bob sees ana vanish", "friend_leave", ana.name)
	ana.loc(lat, lng)
	ana.expect("ghost location rejected", "error", "")
	ana.send(map[string]string{"action": "nearby"})
	m = ana.expect("ghost snapshot", "nearby", "")
	gl, _ := m["nearby"].([]any)
	check("ghost snapshot is empty list", m != nil && m["nearby"] != nil && len(gl) == 0, m)

	code, _ = call("PATCH", "/me", ana.token, map[string]any{"ghost_mode": false})
	check("ghost off", code == 200, code)
	ana.loc(lat, lng)
	bob.expect("bob sees ana again after ghost off", "friend_enter", ana.name)

	// Unfriend
	code, _ = call("DELETE", "/friends/"+bob.id, ana.token, nil)
	check("unfriend", code == 200, code)
	bob.expect("bob sees ana leave on unfriend", "friend_leave", ana.name)
	code, out = call("GET", "/friends", bob.token, nil)
	check("bob friend list empty", code == 200 && len(out["friends"].([]any)) == 0, out)

	// Misc
	code, out = call("GET", "/users/search?username="+bob.name, ana.token, nil)
	check("search by username", code == 200 && out["username"] == bob.name, code, out)
	code, out = call("POST", "/me/photo-upload-url", ana.token, map[string]string{"content_type": "image/png"})
	check("photo upload url", code == 200 && out["upload_url"] != nil, code, out)
	code, _ = call("PATCH", "/me", ana.token, map[string]any{"photo_key": "photos/someone-else/x.png"})
	check("foreign photo key rejected", code == 400, code)
	code, _ = call("PATCH", "/me", ana.token, map[string]any{"photo_key": out["key"]})
	check("own photo key accepted", code == 200, code)

	fmt.Println()
	if failed > 0 {
		fmt.Println(failed, "check(s) FAILED")
		os.Exit(1)
	}
	fmt.Println("all checks passed")
}

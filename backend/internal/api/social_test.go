package api_test

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

func action(c *client, token string, in map[string]any) map[string]any {
	c.t.Helper()
	code, out := c.do("POST", "/app/actions", token, in)
	if code != 200 {
		c.t.Fatalf("action %v: %d %v", in, code, out)
	}
	return out
}
func state(c *client, token string) map[string]any {
	c.t.Helper()
	code, out := c.do("GET", "/app/state", token, nil)
	if code != 200 {
		c.t.Fatalf("state: %d %v", code, out)
	}
	return out
}
func setZone(c *client, token string) {
	action(c, token, map[string]any{"type": "setLocation", "location": map[string]any{"status": "granted", "zoneName": "Mi zona", "center": map[string]float64{"lat": 19.4326, "lng": -99.1332}}})
}
func makeFriends(c *client, a, b, aid string) {
	c.t.Helper()
	code, _ := c.do("POST", "/friends/requests", a, map[string]string{"username": "bob"})
	want(c.t, "request", code, 201)
	code, _ = c.do("POST", "/friends/"+aid+"/accept", b, nil)
	want(c.t, "accept", code, 200)
}
func locate(c *client, id string, lat float64) {
	c.t.Helper()
	if e := c.e.App.HandleLocation(context.Background(), id, models.Location{Lat: lat, Lng: -99.1332}); e != nil {
		c.t.Fatal(e)
	}
}
func publish(c *client, token string) string {
	return action(c, token, map[string]any{"type": "publishPlan", "category": "cafe", "line": "Vamos por un café", "durationMin": 60, "audience": "amigos"})["result"].(map[string]any)["id"].(string)
}

func TestSocialPlanMatchPrivacyAndReward(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	outsider, _ := c.register("carla")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	locate(c, aid, 19.4326)
	locate(c, bid, 19.4327)
	pid := publish(c, a)
	s := state(c, b)
	if len(s["plans"].([]any)) != 1 {
		t.Fatal("friend plan missing")
	}
	if len(s["exactLocations"].(map[string]any)) != 0 {
		t.Fatal("exact location leaked before match")
	}
	plan := s["plans"].([]any)[0].(map[string]any)
	center := plan["zone"].(map[string]any)["center"].(map[string]any)
	if center["lat"] == 19.4326 {
		t.Fatal("plan coordinates were not rounded")
	}
	code, _ := c.do("POST", "/app/actions", outsider, map[string]any{"type": "jalo", "id": pid})
	want(t, "stranger joins", code, 403)
	mid := action(c, b, map[string]any{"type": "jalo", "id": pid})["result"].(string)
	same := action(c, b, map[string]any{"type": "jalo", "id": pid})["result"].(string)
	if mid != same {
		t.Fatal("join not idempotent")
	}
	s = state(c, b)
	if len(s["exactLocations"].(map[string]any)) != 1 {
		t.Fatal("active match has no exact location")
	}
	action(c, a, map[string]any{"type": "quickMessage", "id": mid, "message": "Voy en 10"})
	m := state(c, b)["matches"].([]any)[0].(map[string]any)
	if m["receivedMessage"] != "Voy en 10" {
		t.Fatal("quick message not delivered")
	}
	locate(c, bid, 19.44)
	code, _ = c.do("POST", "/app/actions", b, map[string]any{"type": "confirmMeet", "id": mid})
	want(t, "distant confirmation", code, 400)
	locate(c, bid, 19.4327)
	action(c, b, map[string]any{"type": "confirmMeet", "id": mid, "who": "them"})
	if state(c, a)["xp"].(float64) != 0 {
		t.Fatal("one confirmation rewarded")
	}
	action(c, a, map[string]any{"type": "confirmMeet", "id": mid})
	action(c, a, map[string]any{"type": "confirmMeet", "id": mid})
	if state(c, a)["xp"].(float64) != 20 || state(c, b)["xp"].(float64) != 20 {
		t.Fatal("both participants need exactly one reward")
	}
	code, _ = c.do("POST", "/app/actions", outsider, map[string]any{"type": "confirmMeet", "id": mid})
	want(t, "stranger confirms", code, 403)
	code, _ = c.do("PATCH", "/me", a, map[string]bool{"ghost_mode": true})
	want(t, "ghost", code, 200)
	s = state(c, b)
	if len(s["exactLocations"].(map[string]any)) != 0 {
		t.Fatal("ghost location leaked")
	}
	action(c, b, map[string]any{"type": "block", "userId": aid})
	s = state(c, b)
	if len(s["matches"].([]any)) != 0 || len(s["plans"].([]any)) != 0 {
		t.Fatal("block did not hide content")
	}
	code, _ = c.do("GET", "/users/search?username=alice", b, nil)
	want(t, "blocked search", code, 404)
	code, _ = c.do("GET", "/app/user?username=bob", a, nil)
	want(t, "reverse blocked search", code, 404)
	code, _ = c.do("POST", "/friends/requests", a, map[string]string{"username": "bob"})
	want(t, "blocked friendship", code, 404)
}

func createEvent(c *client, token string, approval bool, capacity int) string {
	return action(c, token, map[string]any{"type": "publishEvent", "eventType": "correr", "title": "Carrera en el parque", "startsAt": time.Now().Add(24 * time.Hour).Format(time.RFC3339), "placeName": "Parque público", "capacity": capacity, "audience": "abierto", "requiresApproval": approval})["result"].(map[string]any)["id"].(string)
}
func enableOpen(c *client, token string) {
	action(c, token, map[string]any{"type": "setOpenMode", "openMode": map[string]bool{"enabled": true, "adult": true, "bigEvents": true, "smallPlans": true}})
}
func TestSocialEventsConsentApprovalCapacityAndPersistence(t *testing.T) {
	c := newClient(t)
	a, _ := c.register("alice")
	b, bid := c.register("bob")
	third, tid := c.register("carla")
	setZone(c, a)
	enableOpen(c, a)
	code, _ := c.do("POST", "/app/actions", b, map[string]any{"type": "setOpenMode", "openMode": map[string]bool{"enabled": true}})
	want(t, "adult consent", code, 400)
	eid := createEvent(c, a, true, 2)
	if len(state(c, b)["events"].([]any)) != 0 {
		t.Fatal("events visible without consent")
	}
	enableOpen(c, b)
	enableOpen(c, third)
	action(c, b, map[string]any{"type": "joinEvent", "id": eid, "pace": "Tranquilo"})
	if state(c, b)["xp"].(float64) != 0 {
		t.Fatal("pending attendance rewarded")
	}
	code, _ = c.do("POST", "/app/actions", b, map[string]any{"type": "approveAttendance", "id": eid, "userId": bid})
	want(t, "self approval", code, 403)
	action(c, a, map[string]any{"type": "approveAttendance", "id": eid, "userId": bid})
	if state(c, b)["xp"].(float64) != 40 {
		t.Fatal("approved attendance not rewarded")
	}
	code, _ = c.do("POST", "/app/actions", third, map[string]any{"type": "joinEvent", "id": eid})
	want(t, "capacity", code, 400)
	action(c, b, map[string]any{"type": "leaveEvent", "id": eid})
	action(c, b, map[string]any{"type": "joinEvent", "id": eid})
	action(c, a, map[string]any{"type": "approveAttendance", "id": eid, "userId": bid})
	if state(c, b)["xp"].(float64) != 40 {
		t.Fatal("rejoin rewarded twice")
	}
	action(c, b, map[string]any{"type": "swipe", "kind": "event", "id": eid, "action": "later"})
	action(c, b, map[string]any{"type": "saveDraft", "draft": map[string]string{"title": "Borrador"}})
	code, out := c.do("POST", "/auth/login", "", map[string]string{"email": "bob@example.com", "password": "password123"})
	want(t, "login", code, 200)
	fresh := state(c, out["token"].(string))
	if fresh["swipes"].(map[string]any)["event:"+eid] != "later" {
		t.Fatal("swipe not persisted")
	}
	if fresh["eventDraft"].(map[string]any)["title"] != "Borrador" {
		t.Fatal("draft not persisted")
	}
	action(c, a, map[string]any{"type": "block", "userId": tid})
	if len(state(c, third)["events"].([]any)) != 0 {
		t.Fatal("blocked organizer event visible")
	}
}

func TestDocumentConcurrentWritesDoNotLoseUpdates(t *testing.T) {
	c := newClient(t)
	ctx := context.Background()
	d, e := c.e.Store.GetDocument(ctx, "race", "one")
	if e != nil {
		t.Fatal(e)
	}
	d.Data = json.RawMessage(`{"count":1}`)
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); errs <- c.e.Store.CommitDocuments(ctx, []store.Document{d}) }()
	}
	wg.Wait()
	close(errs)
	ok, conflict := 0, 0
	for e := range errs {
		if e == nil {
			ok++
		} else if e == store.ErrConflict {
			conflict++
		} else {
			t.Fatal(e)
		}
	}
	if ok != 1 || conflict != 1 {
		t.Fatalf("success=%d conflicts=%d", ok, conflict)
	}
}

func TestRoomiePlanAuthorizationAndMatchExpiry(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	locate(c, aid, 19.4326)
	locate(c, bid, 19.4327)
	pid := action(c, a, map[string]any{"type": "publishPlan", "category": "cafe", "line": "Café con roomies", "durationMin": 60, "audience": "roomies"})["result"].(map[string]any)["id"].(string)
	if len(state(c, b)["plans"].([]any)) != 0 {
		t.Fatal("private roomie plan leaked")
	}
	code, _ := c.do("POST", "/app/actions", b, map[string]any{"type": "jalo", "id": pid})
	want(t, "unselected roomie", code, 403)
	action(c, a, map[string]any{"type": "toggleRoomie", "userId": bid})
	mid := action(c, b, map[string]any{"type": "jalo", "id": pid})["result"].(string)
	d, e := c.e.Store.GetDocument(context.Background(), "match#"+mid, "data")
	if e != nil {
		t.Fatal(e)
	}
	var payload map[string]any
	if e = json.Unmarshal(d.Data, &payload); e != nil {
		t.Fatal(e)
	}
	payload["exactShareUntil"] = time.Now().Add(-time.Minute).Format(time.RFC3339)
	d.Data, _ = json.Marshal(payload)
	if e = c.e.Store.CommitDocuments(context.Background(), []store.Document{d}); e != nil {
		t.Fatal(e)
	}
	if len(state(c, b)["exactLocations"].(map[string]any)) != 0 {
		t.Fatal("expired match revealed exact position")
	}
	code, _ = c.do("POST", "/app/actions", b, map[string]any{"type": "confirmMeet", "id": mid})
	want(t, "expired confirmation", code, 400)
}

type resetMail struct{ link string }

func (m *resetMail) SendReset(_ context.Context, email, link string) error { m.link = link; return nil }
func TestPasswordResetSingleUseAndSessionRevocation(t *testing.T) {
	c := newClient(t)
	token, _ := c.register("alice")
	mail := &resetMail{}
	c.e.App.Mailer = mail
	code, _ := c.do("POST", "/auth/forgot", "", map[string]string{"email": "alice@example.com"})
	want(t, "forgot", code, 202)
	u, e := url.Parse(mail.link)
	if e != nil {
		t.Fatal(e)
	}
	reset := u.Query().Get("reset")
	if reset == "" {
		t.Fatal("reset link missing")
	}
	code, _ = c.do("POST", "/auth/reset", "", map[string]string{"token": reset, "password": "newpassword123"})
	want(t, "reset", code, 200)
	code, _ = c.do("GET", "/me", token, nil)
	want(t, "old session", code, 401)
	code, _ = c.do("POST", "/auth/reset", "", map[string]string{"token": reset, "password": "otherpassword123"})
	want(t, "reused reset", code, 400)
	code, _ = c.do("POST", "/auth/login", "", map[string]string{"email": "alice@example.com", "password": "password123"})
	want(t, "old password", code, 401)
	code, out := c.do("POST", "/auth/login", "", map[string]string{"email": "alice@example.com", "password": "newpassword123"})
	want(t, "new password", code, 200)
	code, _ = c.do("GET", "/me", out["token"].(string), nil)
	want(t, "new session", code, 200)
	mail.link = ""
	code, _ = c.do("POST", "/auth/forgot", "", map[string]string{"email": "unknown@example.com"})
	want(t, "unknown email", code, 202)
	if strings.Contains(mail.link, "reset") {
		t.Fatal("unknown account email sent")
	}
}

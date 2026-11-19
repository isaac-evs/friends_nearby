package api_test

import (
	"context"
	"encoding/json"
	"github.com/google/uuid"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
)

func action(c *client, token string, in map[string]any) map[string]any {
	c.t.Helper()
	if in["requestId"] == nil {
		in["requestId"] = uuid.NewString()
	}
	code, out := c.do("POST", "/app/actions", token, in)
	if code != 200 {
		c.t.Fatalf("action %v: %d %v", in, code, out)
	}
	return out
}
func rejected(c *client, token string, in map[string]any, expected int) {
	c.t.Helper()
	in["requestId"] = uuid.NewString()
	code, out := c.do("POST", "/app/actions", token, in)
	if code != expected {
		c.t.Fatalf("expected %d got %d: %v", expected, code, out)
	}
}
func state(c *client, token string) map[string]any {
	c.t.Helper()
	code, out := c.do("GET", "/app/state", token, nil)
	if code != 200 {
		c.t.Fatalf("state %d %v", code, out)
	}
	return out
}
func setZone(c *client, token string) {
	action(c, token, map[string]any{"type": "setLocation", "location": map[string]any{"status": "manual", "center": map[string]any{"lat": 19.432, "lng": -99.134}}})
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
	if e := c.e.App.HandleLocation(context.Background(), id, models.Location{Lat: lat, Lng: -99.134}); e != nil {
		c.t.Fatal(e)
	}
}
func publishInput() map[string]any {
	return map[string]any{"type": "publishPlan", "category": "cafe", "line": "Café en la plaza", "startsAt": time.Now().Add(-time.Minute).UTC().Format(time.RFC3339), "durationMin": 60, "joinPolicy": "friends_and_guests", "lateJoin": true, "place": map[string]any{"name": "Plaza pública", "center": map[string]any{"lat": 19.434, "lng": -99.134}}}
}
func publish(c *client, token string) string {
	return action(c, token, publishInput())["result"].(map[string]any)["id"].(string)
}
func TestPublicVenueManualDiscoveryCancellationAndIncomingMatch(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, _ := c.register("bob")
	outsider, _ := c.register("carla")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	pid := publish(c, a)
	s := state(c, b)
	plans := s["plans"].([]any)
	if len(plans) != 1 {
		t.Fatal("manual location plan missing")
	}
	pl := plans[0].(map[string]any)
	if pl["place"].(map[string]any)["center"].(map[string]any)["lat"] != 19.434 {
		t.Fatal("public venue overwritten with private center")
	}
	rejected(c, outsider, map[string]any{"type": "jalo", "id": pid}, 403)
	mid := action(c, b, map[string]any{"type": "jalo", "id": pid})["result"].(string)
	if len(state(c, a)["matches"].([]any)) != 1 {
		t.Fatal("host cannot discover incoming encounter")
	}
	if len(state(c, a)["exactLocations"].(map[string]any)) != 0 {
		t.Fatal("match automatically granted exact location")
	}
	action(c, a, map[string]any{"type": "quickMessage", "id": mid, "message": "Voy en 10"})
	if state(c, b)["matches"].([]any)[0].(map[string]any)["receivedMessage"] != "Voy en 10" {
		t.Fatal("message not delivered")
	}
	rejected(c, b, map[string]any{"type": "verifyTogether", "id": mid, "center": map[string]any{"lat": 20, "lng": -99}}, 400)
	for _, token := range []string{a, b} {
		action(c, token, map[string]any{"type": "verifyTogether", "id": mid, "center": map[string]any{"lat": 19.434, "lng": -99.134}})
		action(c, token, map[string]any{"type": "confirmMeet", "id": mid})
	}
	xp := state(c, a)["xp"]
	if xp.(float64) <= 0 {
		t.Fatal("mutual check-in did not reward")
	}
	action(c, a, map[string]any{"type": "confirmMeet", "id": mid})
	if state(c, a)["xp"] != xp {
		t.Fatal("reward duplicated")
	}
	action(c, a, map[string]any{"type": "removePlan", "id": pid})
	for _, token := range []string{a, b} {
		s = state(c, token)
		if len(s["plans"].([]any)) != 0 || len(s["matches"].([]any)) != 0 {
			t.Fatal("canceled plan resurrected")
		}
	}
}
func TestClosePresenceAndExplicitExactConsent(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	locate(c, aid, 19.432345)
	locate(c, bid, 19.4324)
	if !state(c, b)["friendships"].(map[string]any)[aid].(map[string]any)["locationPaused"].(bool) {
		t.Fatal("normal friend saw presence")
	}
	action(c, a, map[string]any{"type": "requestClose", "userId": bid})
	action(c, b, map[string]any{"type": "acceptClose", "userId": aid})
	if state(c, a)["friendships"].(map[string]any)[bid].(map[string]any)["locationPaused"].(bool) {
		t.Fatal("close guest without plan missing on map")
	}
	action(c, a, map[string]any{"type": "startExact", "userId": bid, "minutes": 60})
	locate(c, aid, 19.432345)
	if len(state(c, b)["exactLocations"].(map[string]any)) != 1 {
		t.Fatal("explicit exact location missing")
	}
	loc, _ := c.e.App.Loc.Get(context.Background(), aid)
	if loc.Lat == 19.432345 {
		t.Fatal("raw GPS in normal presence")
	}
	for _, body := range c.e.Queue.Bodies {
		if strings.Contains(string(body), "19.432345") {
			t.Fatal("raw GPS persisted to history")
		}
	}
	action(c, b, map[string]any{"type": "setGhost", "enabled": true})
	action(c, b, map[string]any{"type": "setGhost", "enabled": false})
	locate(c, aid, 19.432345)
	if len(state(c, b)["exactLocations"].(map[string]any)) != 0 {
		t.Fatal("incoming exact grant revived after ghost")
	}
	action(c, a, map[string]any{"type": "startExact", "userId": bid, "minutes": 30})
	locate(c, aid, 19.432345)
	action(c, a, map[string]any{"type": "stopExact", "userId": bid})
	if len(state(c, b)["exactLocations"].(map[string]any)) != 0 {
		t.Fatal("revoked exact grant still visible")
	}
	action(c, a, map[string]any{"type": "removeClose", "userId": bid})
	if !state(c, b)["friendships"].(map[string]any)[aid].(map[string]any)["locationPaused"].(bool) {
		t.Fatal("presence visible after removing close")
	}
}
func open(c *client, token string, enabled bool) {
	action(c, token, map[string]any{"type": "setOpenMode", "openMode": map[string]any{"enabled": enabled, "adult": true, "bigEvents": true, "smallPlans": true}})
}
func eventInput() map[string]any {
	return map[string]any{"type": "publishEvent", "eventType": "arte", "title": "Museo de la plaza", "startsAt": time.Now().Add(time.Hour).UTC().Format(time.RFC3339), "endsAt": time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339), "placeName": "Museo público", "capacity": 2, "requiresApproval": true, "center": map[string]any{"lat": 19.434, "lng": -99.134}}
}
func TestEventVenueApprovalAndLeaveWithOpenModeDisabled(t *testing.T) {
	c := newClient(t)
	a, _ := c.register("alice")
	b, bid := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	open(c, a, true)
	open(c, b, true)
	bad := eventInput()
	delete(bad, "center")
	rejected(c, a, bad, 400)
	ev := action(c, a, eventInput())["result"].(map[string]any)
	id := ev["id"].(string)
	action(c, b, map[string]any{"type": "joinEvent", "id": id})
	action(c, a, map[string]any{"type": "approveAttendance", "id": id, "userId": bid})
	xp := state(c, b)["xp"]
	open(c, b, false)
	if len(state(c, b)["events"].([]any)) != 1 {
		t.Fatal("existing attendance hidden with open mode disabled")
	}
	action(c, b, map[string]any{"type": "leaveEvent", "id": id})
	if len(state(c, b)["attendances"].([]any)) != 0 {
		t.Fatal("cannot leave attendance")
	}
	if state(c, b)["xp"] != xp {
		t.Fatal("leave modified rewards")
	}
}
func TestActionReceiptReplayAndProfileChange(t *testing.T) {
	c := newClient(t)
	a, _ := c.register("alice")
	setZone(c, a)
	in := publishInput()
	in["requestId"] = uuid.NewString()
	one := action(c, a, in)
	two := action(c, a, in)
	if one["result"].(map[string]any)["id"] != two["result"].(map[string]any)["id"] || len(state(c, a)["plans"].([]any)) != 1 {
		t.Fatal("replayed publication duplicated")
	}
	in["line"] = "Otra operación"
	code, _ := c.do("POST", "/app/actions", a, in)
	want(t, "receipt mismatch", code, 409)
	action(c, a, map[string]any{"type": "updateHandle", "username": "alice.test"})
	code, out := c.do("GET", "/usernames/alice.test", a, nil)
	want(t, "availability", code, 200)
	if out["available"] != true {
		t.Fatal("own username unavailable")
	}
	c.ws("$connect", "old-password-session", "", map[string]string{"token": a})
	code, out = c.do("POST", "/me/password", a, map[string]string{"current": "password123", "next": "newpassword456"})
	want(t, "change password", code, 200)
	if code == 200 {
		code, _ = c.do("GET", "/me", a, nil)
		want(t, "old session", code, 401)
		c.e.Pusher.Reset()
		c.e.App.NotifyChange(context.Background(), state(c, out["token"].(string))["session"].(map[string]any)["userId"].(string))
		if len(c.e.Pusher.Messages("old-password-session")) != 0 {
			t.Fatal("revoked session received a push")
		}
		code, _ = c.do("GET", "/me", out["token"].(string), nil)
		want(t, "new session", code, 200)
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

func TestInvitationsAndOverlappingReservations(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, _ := c.register("bob")
	d, did := c.register("diana")
	setZone(c, a)
	setZone(c, b)
	setZone(c, d)
	makeFriends(c, a, b, aid)
	code, _ := c.do("POST", "/friends/requests", b, map[string]string{"username": "diana"})
	want(t, "guest friendship request", code, 201)
	_, me := c.do("GET", "/me", b, nil)
	bid := me["user_id"].(string)
	code, _ = c.do("POST", "/friends/"+bid+"/accept", d, nil)
	want(t, "guest friendship accept", code, 200)
	pid := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	action(c, b, map[string]any{"type": "invitePeople", "id": pid, "inviteIds": []string{did}})
	inv := state(c, d)["invites"].([]any)[0].(map[string]any)
	rejected(c, a, map[string]any{"type": "respondInvite", "id": inv["id"], "accept": true}, 400)
	action(c, d, map[string]any{"type": "respondInvite", "id": inv["id"], "accept": true})
	if len(state(c, d)["matches"].([]any)) != 1 {
		t.Fatal("invited guest did not join")
	}
	rejected(c, d, publishInput(), 409)
}

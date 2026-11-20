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

func planInState(c *client, token, pid string) map[string]any {
	for _, p := range state(c, token)["plans"].([]any) {
		if m := p.(map[string]any); m["id"] == pid {
			return m
		}
	}
	return nil
}

func TestPlanVisibilityChatAndDistanceToVenue(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	d, did := c.register("diana")
	e, _ := c.register("erika")
	for _, tok := range []string{a, b, d, e} {
		setZone(c, tok)
	}
	makeFriends(c, a, b, aid)
	code, _ := c.do("POST", "/friends/requests", b, map[string]string{"username": "diana"})
	want(t, "bob→diana", code, 201)
	code, _ = c.do("POST", "/friends/"+bid+"/accept", d, nil)
	want(t, "diana accepts", code, 200)
	pid := publish(c, a)

	// Ni amigo de quien organiza ni invitado: no ve el plan ni puede unirse.
	if planInState(c, d, pid) != nil || planInState(c, e, pid) != nil {
		t.Fatal("a stranger can see the plan")
	}
	rejected(c, d, map[string]any{"type": "jalo", "id": pid}, 403)

	// Un amigo lo invita: solo entonces ve el lugar, y no ve a desconocidos entre quienes van.
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	action(c, b, map[string]any{"type": "invitePeople", "id": pid, "inviteIds": []string{did}})
	if planInState(c, d, pid) == nil {
		t.Fatal("invited friend-of-friend cannot see the plan")
	}
	if ids := planInState(c, d, pid)["memberIds"].([]any); len(ids) != 2 || !(ids[0] == bid || ids[1] == bid) {
		t.Fatalf("invitee sees strangers: %v", ids)
	}

	// Chat libre solo entre integrantes, con límite de largo.
	rejected(c, d, map[string]any{"type": "planMessage", "id": pid, "message": "hola"}, 400)
	action(c, b, map[string]any{"type": "planMessage", "id": pid, "message": "  Voy con 🥤 y\nhielo  "})
	rejected(c, b, map[string]any{"type": "planMessage", "id": pid, "message": strings.Repeat("x", 281)}, 400)
	rejected(c, b, map[string]any{"type": "planMessage", "id": pid, "message": "   "}, 400)
	tl := planInState(c, a, pid)["timeline"].([]any)
	if m := tl[len(tl)-1].(map[string]any); m["text"] != "Voy con 🥤 y hielo" || m["userId"] != bid {
		t.Fatalf("bad timeline %v", tl)
	}

	// A cuánto está del lugar: solo integrantes, redondeado, sin coordenadas.
	locate(c, bid, 19.432)
	var found bool
	for _, r := range planInState(c, a, pid)["roster"].([]any) {
		if m := r.(map[string]any); m["userId"] == bid {
			found = true
			if m["distanceM"] != float64(200) {
				t.Fatalf("distance %v", m["distanceM"])
			}
			if _, leaks := m["lat"]; leaks {
				t.Fatal("roster leaks coordinates")
			}
		}
	}
	if !found {
		t.Fatal("bob missing from roster")
	}
	if planInState(c, d, pid)["roster"] != nil {
		t.Fatal("non-member sees the roster")
	}
}

func TestChatThemeDeleteAndCheckInReason(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, _ := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	pid := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid})

	// Solo quien organiza cambia el tema del chat y borra mensajes.
	rejected(c, b, map[string]any{"type": "setChatTheme", "id": pid, "message": "verde"}, 403)
	rejected(c, a, map[string]any{"type": "setChatTheme", "id": pid, "message": "fucsia"}, 400)
	action(c, a, map[string]any{"type": "setChatTheme", "id": pid, "message": "verde"})
	if planInState(c, b, pid)["chatTheme"] != "verde" {
		t.Fatal("theme not shared")
	}
	action(c, b, map[string]any{"type": "planMessage", "id": pid, "message": "hola"})
	msg := planInState(c, a, pid)["timeline"].([]any)[0].(map[string]any)
	action(c, a, map[string]any{"type": "planMessage", "id": pid, "message": "otro"})
	rejected(c, b, map[string]any{"type": "deleteChatMessage", "id": pid, "message": planInState(c, a, pid)["timeline"].([]any)[1].(map[string]any)["id"]}, 403)
	// Cada quien borra los suyos; quien organiza, cualquiera; nadie borra los de otra persona.
	action(c, b, map[string]any{"type": "deleteChatMessage", "id": pid, "message": msg["id"]})
	if tl := planInState(c, a, pid)["timeline"].([]any); len(tl) != 1 {
		t.Fatalf("own message not deleted: %v", tl)
	}
	action(c, a, map[string]any{"type": "deleteChatMessage", "id": pid, "message": planInState(c, a, pid)["timeline"].([]any)[0].(map[string]any)["id"]})
	if tl := planInState(c, a, pid)["timeline"]; tl != nil && len(tl.([]any)) != 0 {
		t.Fatalf("message not deleted: %v", tl)
	}

	// El check-in lejos dice a cuánto estás.
	code, out := c.do("POST", "/app/actions", b, map[string]any{"type": "checkIn", "id": pid, "requestId": uuid.NewString(), "center": map[string]any{"lat": 19.44, "lng": -99.134}, "accuracy": 10})
	want(t, "far check-in", code, 400)
	if !strings.Contains(out["error"].(string), "estás a unos") {
		t.Fatalf("no distance in %v", out)
	}
	action(c, b, map[string]any{"type": "checkIn", "id": pid, "requestId": uuid.NewString(), "center": map[string]any{"lat": 19.4341, "lng": -99.134}, "accuracy": 10})
}

func TestFinishedPlanStaysInHistoryForParticipants(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, _ := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	pid := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	action(c, b, map[string]any{"type": "planMessage", "id": pid, "message": "nos vemos"})
	action(c, a, map[string]any{"type": "endPlan", "id": pid})
	if planInState(c, a, pid) != nil {
		t.Fatal("finished plan still listed as active")
	}
	for _, tok := range []string{a, b} {
		past := state(c, tok)["pastPlans"].([]any)
		if len(past) != 1 || past[0].(map[string]any)["id"] != pid || len(past[0].(map[string]any)["timeline"].([]any)) != 1 {
			t.Fatalf("history missing: %v", past)
		}
	}
	d, _ := c.register("diana")
	if len(state(c, d)["pastPlans"].([]any)) != 0 {
		t.Fatal("history leaked to a stranger")
	}
}

func meLevel(c *client, token string) (level, totalXP float64) {
	st := state(c, token)
	m := st["users"].(map[string]any)[st["session"].(map[string]any)["userId"].(string)].(map[string]any)
	return m["level"].(float64), m["totalXp"].(float64)
}

func TestLeavingAfterStartCostsMoreAndLevelOneGoesToZeroThenRecovers(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, _ := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	pid := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	action(c, b, map[string]any{"type": "leavePlan", "id": pid}) // el plan ya empezó y no llegaste: −100 XP
	if lvl, _ := meLevel(c, b); lvl != 0 {
		t.Fatalf("level 1 without XP should drop to 0, got %v", lvl)
	}
	// Con ganar ≥ 10 XP se vuelve al nivel 1.
	action(c, a, map[string]any{"type": "removePlan", "id": pid})
	pid2 := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid2})
	action(c, b, map[string]any{"type": "checkIn", "id": pid2, "requestId": uuid.NewString(), "center": map[string]any{"lat": 19.4341, "lng": -99.134}, "accuracy": 10})
	if lvl, _ := meLevel(c, b); lvl != 1 {
		t.Fatalf("expected recovery to level 1, got %v", lvl)
	}
}

func TestCheckInFallsBackToLastKnownLocation(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	pid := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	// Sin lectura del dispositivo ni ubicación conocida: no hay forma de verificar.
	rejected(c, b, map[string]any{"type": "checkIn", "id": pid}, 400)
	// Con la última ubicación conocida dentro del rango (250 m), basta.
	locate(c, bid, 19.434)
	action(c, b, map[string]any{"type": "checkIn", "id": pid})
	for _, r := range planInState(c, a, pid)["roster"].([]any) {
		if m := r.(map[string]any); m["userId"] == bid && m["arrivedAt"] == nil {
			t.Fatal("bob was not verified")
		}
	}
}

func TestArrivalXPDependsOnPunctuality(t *testing.T) {
	for _, tc := range []struct {
		startedMinAgo int
		xp            float64
		label         string
	}{{-8, 30, "temprano"}, {-1, 20, "a tiempo"}} {
		c := newClient(t)
		a, aid := c.register("alice")
		b, _ := c.register("bob")
		setZone(c, a)
		setZone(c, b)
		makeFriends(c, a, b, aid)
		in := publishInput()
		in["startsAt"] = time.Now().Add(-time.Duration(tc.startedMinAgo) * time.Minute).UTC().Format(time.RFC3339)
		in["durationMin"] = 120
		pid := action(c, a, in)["result"].(map[string]any)["id"].(string)
		action(c, b, map[string]any{"type": "jalo", "id": pid})
		out := action(c, b, map[string]any{"type": "checkIn", "id": pid, "center": map[string]any{"lat": 19.4341, "lng": -99.134}})
		res := out["result"].(map[string]any)
		if res["xp"] != tc.xp || res["punctuality"] != tc.label {
			t.Fatalf("started %d min ago: got %v", tc.startedMinAgo, res)
		}
	}
}

func TestCanceledPlansHistory(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, _ := c.register("bob")
	d, did := c.register("diana")
	setZone(c, a)
	setZone(c, b)
	setZone(c, d)
	makeFriends(c, a, b, aid)
	code, _ := c.do("POST", "/friends/requests", d, map[string]string{"username": "alice"})
	want(t, "diana→alice", code, 201)
	_ = did
	pid := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	action(c, b, map[string]any{"type": "leavePlan", "id": pid})
	left := state(c, b)["canceledPlans"].([]any)
	if len(left) != 1 || left[0].(map[string]any)["kind"] != "left" {
		t.Fatalf("leaving not in history: %v", left)
	}
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	action(c, a, map[string]any{"type": "removePlan", "id": pid})
	for _, tok := range []string{a, b} {
		list := state(c, tok)["canceledPlans"].([]any)
		if len(list) != 1 || list[0].(map[string]any)["kind"] != "canceled" {
			t.Fatalf("canceled plan missing: %v", list)
		}
	}
	if got := state(c, a)["canceledPlans"].([]any)[0].(map[string]any)["byMe"]; got != true {
		t.Fatal("organizer should see byMe")
	}
	if len(state(c, d)["canceledPlans"].([]any)) != 0 {
		t.Fatal("canceled history leaked to a stranger")
	}
}

func TestDeleteAccountCleansUpAndFreesIdentity(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	pid := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	bobPlan := action(c, b, map[string]any{"type": "publishPlan", "category": "cafe", "line": "Plan de Bob", "startsAt": time.Now().Add(3 * time.Hour).UTC().Format(time.RFC3339), "durationMin": 60, "joinPolicy": "friends", "lateJoin": true, "place": map[string]any{"name": "Café", "center": map[string]any{"lat": 19.434, "lng": -99.134}}})["result"].(map[string]any)["id"].(string)

	code, _ := c.do("POST", "/me/delete", b, map[string]string{"password": "incorrecta1"})
	want(t, "wrong password", code, 400)
	code, _ = c.do("POST", "/me/delete", b, map[string]string{"password": "password123"})
	want(t, "delete", code, 200)

	// Ya no puede entrar y su correo y usuario quedan libres.
	code, _ = c.do("POST", "/auth/login", "", map[string]string{"email": "bob@example.com", "password": "password123"})
	if code == 200 {
		t.Fatal("deleted account can still log in")
	}
	_, _ = c.register("bob")
	// Su plan se canceló y de los demás salió.
	if planInState(c, a, bobPlan) != nil {
		t.Fatal("deleted user's plan still active")
	}
	for _, m := range planInState(c, a, pid)["memberIds"].([]any) {
		if m == bid {
			t.Fatal("deleted user still listed in a plan")
		}
	}
}

func TestEventsRequireOpenModeEvenWhenInvited(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	open(c, a, true)
	in := eventInput()
	in["inviteIds"] = []string{bid}
	id := action(c, a, in)["result"].(map[string]any)["id"].(string)
	rejected(c, b, map[string]any{"type": "joinEvent", "id": id}, 403)
	// Aceptar la invitación tampoco salta el modo abierto: el cliente te lleva a activarlo primero.
	inv := state(c, b)["invites"].([]any)
	rejected(c, b, map[string]any{"type": "respondInvite", "id": inv[0].(map[string]any)["id"], "accept": true}, 403)
	open(c, b, true)
	action(c, b, map[string]any{"type": "respondInvite", "id": inv[0].(map[string]any)["id"], "accept": true})
	if len(state(c, b)["attendances"].([]any)) != 1 {
		t.Fatal("could not join after enabling open mode")
	}
}

func eventByID(c *client, token, id string) map[string]any {
	for _, e := range state(c, token)["events"].([]any) {
		if m := e.(map[string]any); m["id"] == id {
			return m
		}
	}
	return nil
}

func TestEventDescriptionEditCancelAnnouncementsAndChat(t *testing.T) {
	c := newClient(t)
	a, _ := c.register("alice")
	b, _ := c.register("bob")
	d, _ := c.register("diana")
	for _, tok := range []string{a, b, d} {
		setZone(c, tok)
		open(c, tok, true)
	}
	in := eventInput()
	in["requiresApproval"] = false
	in["capacity"] = 5
	in["description"] = "  Visita guiada\ncon café  "
	id := action(c, a, in)["result"].(map[string]any)["id"].(string)
	action(c, b, map[string]any{"type": "joinEvent", "id": id})
	if got := eventByID(c, a, id)["description"]; got != "Visita guiada\ncon café" {
		t.Fatalf("description %q", got)
	}

	// Solo quien organiza edita, cancela, publica avisos y activa el chat.
	for _, typ := range []string{"cancelEvent", "postAnnouncement", "setEventChat", "updateEvent"} {
		rejected(c, b, map[string]any{"type": typ, "id": id, "message": "x"}, 403)
	}
	action(c, a, map[string]any{"type": "postAnnouncement", "id": id, "message": "Llevar identificación"})
	if an := eventByID(c, b, id)["announcements"].([]any); len(an) != 1 {
		t.Fatalf("announcement missing: %v", an)
	}
	rejected(c, a, map[string]any{"type": "postAnnouncement", "id": id, "message": "   "}, 400)

	// Chat: apagado por defecto; con él encendido solo escriben quienes van.
	rejected(c, b, map[string]any{"type": "eventMessage", "id": id, "message": "hola"}, 400)
	action(c, a, map[string]any{"type": "setEventChat", "id": id, "accept": true})
	action(c, b, map[string]any{"type": "eventMessage", "id": id, "message": "¿A qué hora?"})
	rejected(c, d, map[string]any{"type": "eventMessage", "id": id, "message": "yo no voy"}, 403)
	if tl := eventByID(c, b, id)["timeline"].([]any); len(tl) != 1 {
		t.Fatalf("chat timeline: %v", tl)
	}
	if eventByID(c, d, id)["timeline"] != nil {
		t.Fatal("chat leaked to a non-attendee")
	}
	msg := eventByID(c, a, id)["timeline"].([]any)[0].(map[string]any)
	action(c, a, map[string]any{"type": "deleteEventMessage", "id": id, "message": msg["id"]})

	// Editar: no se puede bajar el cupo por debajo de quienes ya van; con datos válidos se actualiza.
	edit := map[string]any{"type": "updateEvent", "id": id, "title": "Museo (nueva hora)", "description": "Otra descripción", "startsAt": in["startsAt"], "endsAt": in["endsAt"], "placeName": "Museo público", "center": in["center"], "capacity": 1, "lateJoin": true, "requiresApproval": false}
	rejected(c, a, edit, 400)
	edit["capacity"] = 8
	action(c, a, edit)
	if e := eventByID(c, b, id); e["title"] != "Museo (nueva hora)" || e["capacity"] != float64(8) || e["description"] != "Otra descripción" {
		t.Fatalf("not edited: %v", e)
	}

	action(c, a, map[string]any{"type": "cancelEvent", "id": id})
	if eventByID(c, b, id) != nil || eventByID(c, a, id) != nil {
		t.Fatal("canceled event still listed")
	}
}

// El organizador gana XP al publicar (60) y +5 por cada persona que se une; el tipo "otro" lleva nombre e ícono propios.
func TestEventOrganizerXPAndCustomType(t *testing.T) {
	c := newClient(t)
	a, _ := c.register("alice")
	b, _ := c.register("bob")
	for _, tok := range []string{a, b} {
		setZone(c, tok)
		open(c, tok, true)
	}
	in := eventInput()
	in["requiresApproval"] = false
	in["capacity"] = 5
	in["eventType"] = "otro"
	in["subtype"] = "Noche de karaoke para toda la banda"
	in["typeIcon"] = "mic"
	in["typeColor"] = "musica"
	id := action(c, a, in)["result"].(map[string]any)["id"].(string)
	ev := eventByID(c, a, id)
	if ev["subtype"] != "Noche de karaoke par" || ev["typeIcon"] != "mic" || ev["typeColor"] != "musica" {
		t.Fatalf("custom type = %v / %v", ev["subtype"], ev["typeIcon"])
	}
	before := state(c, a)["xp"].(float64)
	action(c, b, map[string]any{"type": "joinEvent", "id": id})
	if got := state(c, a)["xp"].(float64); got != before+5 {
		t.Fatalf("organizer xp %v → %v, want +5", before, got)
	}
	// Lejos del lugar no hay check-in.
	rejected(c, b, map[string]any{"type": "checkInEvent", "id": id, "center": map[string]any{"lat": 19.5, "lng": -99.2}}, 400)
}

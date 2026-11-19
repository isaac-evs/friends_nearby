package app_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/isaac-evs/friends_nearby/backend/internal/app"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
	"github.com/isaac-evs/friends_nearby/backend/internal/testenv"
)

func expectTypes(t *testing.T, label string, got []string, want ...string) {
	t.Helper()
	if len(got) == 0 && len(want) == 0 {
		return
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("%s: got %v, want %v", label, got, want)
	}
}

func mustMove(t *testing.T, e *testenv.Env, u *testenv.User, lat, lng float64) {
	t.Helper()
	if err := e.Move(u, lat, lng); err != nil {
		t.Fatalf("move %s: %v", u.Username, err)
	}
}

func TestEnterAndLeaveOnlyOnTransitions(t *testing.T) {
	e := testenv.New(t)
	a, b := e.AddUser(t, "ana"), e.AddUser(t, "bob")
	befriendClose(t, e, a, b)

	mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	expectTypes(t, "ana after first move (bob has no location)", e.Types(a))

	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(50), testenv.BaseLng)
	expectTypes(t, "ana after bob arrives", e.Types(a), app.MsgFriendEnter)
	expectTypes(t, "bob after he arrives", e.Types(b), app.MsgFriendEnter)

	// Staying inside the radius must not produce more messages.
	mustMove(t, e, a, testenv.BaseLat+testenv.Meters(10), testenv.BaseLng)
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(60), testenv.BaseLng)
	expectTypes(t, "ana while staying near", e.Types(a), app.MsgFriendEnter)
	expectTypes(t, "bob while staying near", e.Types(b), app.MsgFriendEnter)

	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(2000), testenv.BaseLng)
	expectTypes(t, "ana after bob leaves", e.Types(a), app.MsgFriendEnter, app.MsgFriendLeave)
	expectTypes(t, "bob after he leaves", e.Types(b), app.MsgFriendEnter, app.MsgFriendLeave)

	// Re-entering fires again.
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(80), testenv.BaseLng)
	expectTypes(t, "ana after bob returns", e.Types(a), app.MsgFriendEnter, app.MsgFriendLeave, app.MsgFriendEnter)
}

func TestMessagePayload(t *testing.T) {
	e := testenv.New(t)
	a, b := e.AddUser(t, "ana"), e.AddUser(t, "bob")
	befriendClose(t, e, a, b)
	mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(100), testenv.BaseLng)

	msgs := e.Pusher.Messages(a.ConnID)
	if len(msgs) != 1 || msgs[0].Friend == nil || msgs[0].Distance == nil {
		t.Fatalf("unexpected messages: %+v", msgs)
	}
	if msgs[0].Friend.Username != "bob" || msgs[0].Friend.UserID != b.UserID {
		t.Errorf("wrong friend in message: %+v", msgs[0].Friend)
	}
	if d := *msgs[0].Distance; d%50 != 0 {
		t.Errorf("distance_m = %d, want about 100", d)
	}
}

func TestRadiusIsPerViewer(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	a, b := e.AddUser(t, "ana"), e.AddUser(t, "bob")
	befriendClose(t, e, a, b)
	for _, entry := range []struct {
		u, other *testenv.User
		radius   int
	}{{a, b, 100}, {b, a, 500}} {
		d, _ := e.Store.GetDocument(ctx, "user#"+entry.u.UserID, "profile")
		d.Data, _ = json.Marshal(map[string]any{"close": map[string]string{entry.other.UserID: "mutual"}, "radiusM": entry.radius, "visibilityRadiusM": 500})
		if err := e.Store.CommitDocuments(ctx, []store.Document{d}); err != nil {
			t.Fatal(err)
		}
	}

	mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(300), testenv.BaseLng)

	expectTypes(t, "bob (radius 500) sees ana at 300 m", e.Types(b), app.MsgFriendEnter)
	expectTypes(t, "ana (radius 100) does not see bob at 300 m", e.Types(a))

	// Bob comes within ana's radius: now she sees him too.
	mustMove(t, e, b, testenv.BaseLat, testenv.BaseLng)
	expectTypes(t, "ana sees bob at 60 m", e.Types(a), app.MsgFriendEnter)
}

func TestOnlyAcceptedFriendsSeeEachOther(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	a, stranger, pending := e.AddUser(t, "ana"), e.AddUser(t, "sam"), e.AddUser(t, "pat")
	if err := e.Store.CreateRequest(ctx, a.UserID, pending.UserID); err != nil {
		t.Fatal(err)
	}
	for _, u := range []*testenv.User{a, stranger, pending} {
		mustMove(t, e, u, testenv.BaseLat, testenv.BaseLng)
	}
	for _, u := range []*testenv.User{a, stranger, pending} {
		expectTypes(t, u.Username, e.Types(u))
	}
}

func TestGhostMode(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	a, b := e.AddUser(t, "ana"), e.AddUser(t, "bob")
	befriendClose(t, e, a, b)
	mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(50), testenv.BaseLng)
	e.Pusher.Reset()
	queued := e.Queue.Count()

	on := true
	ghost, err := e.Store.UpdateProfile(ctx, a.UserID, store.ProfilePatch{GhostMode: &on})
	if err != nil {
		t.Fatal(err)
	}
	if err := e.App.EnterGhost(ctx, ghost); err != nil {
		t.Fatal(err)
	}
	expectTypes(t, "bob sees ana vanish", e.Types(b), app.MsgFriendLeave)
	expectTypes(t, "ana's own view is cleared", e.Types(a), app.MsgFriendLeave)

	if loc, _ := e.App.Loc.Get(ctx, a.UserID); loc != nil {
		t.Errorf("ghost user still has a live location: %+v", loc)
	}
	if err := e.Move(a, testenv.BaseLat, testenv.BaseLng); !errors.Is(err, app.ErrGhostMode) {
		t.Errorf("ghost location update: got %v, want ErrGhostMode", err)
	}
	if got := e.Queue.Count(); got != queued {
		t.Errorf("ghost mode must not record history: queue went from %d to %d", queued, got)
	}

	// Bob keeps moving while ana is hidden: nothing is shown.
	e.Pusher.Reset()
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(55), testenv.BaseLng)
	expectTypes(t, "bob while ana is ghost", e.Types(b))
	if list, _ := e.App.Snapshot(ctx, b.UserID); len(list) != 0 {
		t.Errorf("bob's snapshot should be empty, got %+v", list)
	}
	if list, _ := e.App.Snapshot(ctx, a.UserID); len(list) != 0 {
		t.Errorf("ghost snapshot should be empty, got %+v", list)
	}

	// Turning ghost mode off and moving brings her back.
	off := false
	if _, err := e.Store.UpdateProfile(ctx, a.UserID, store.ProfilePatch{GhostMode: &off}); err != nil {
		t.Fatal(err)
	}
	mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	expectTypes(t, "bob sees ana return", e.Types(b), app.MsgFriendEnter)
	expectTypes(t, "ana sees bob again", e.Types(a), app.MsgFriendEnter)
}

func TestUnfriendClearsNearbyState(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	a, b := e.AddUser(t, "ana"), e.AddUser(t, "bob")
	befriendClose(t, e, a, b)
	mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(50), testenv.BaseLng)
	e.Pusher.Reset()

	if err := e.Store.DeleteFriendship(ctx, a.UserID, b.UserID); err != nil {
		t.Fatal(err)
	}
	if err := e.App.CleanupPair(ctx, a.User, b.User); err != nil {
		t.Fatal(err)
	}
	expectTypes(t, "ana", e.Types(a), app.MsgFriendLeave)
	expectTypes(t, "bob", e.Types(b), app.MsgFriendLeave)

	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(40), testenv.BaseLng)
	expectTypes(t, "ana after unfriend + move", e.Types(a), app.MsgFriendLeave)
	expectTypes(t, "bob after unfriend + move", e.Types(b), app.MsgFriendLeave)
}

func TestFriendWhoWentInactiveIsDroppedOnNextUpdate(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	a, b := e.AddUser(t, "ana"), e.AddUser(t, "bob")
	befriendClose(t, e, a, b)
	mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(50), testenv.BaseLng)

	// Simulate ana's location expiring in Redis.
	if err := e.App.Loc.Delete(ctx, a.UserID); err != nil {
		t.Fatal(err)
	}
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(51), testenv.BaseLng)
	expectTypes(t, "bob learns ana is gone", e.Types(b), app.MsgFriendEnter, app.MsgFriendLeave)
}

func TestHistoryEventsAndLocationValidation(t *testing.T) {
	e := testenv.New(t)
	a := e.AddUser(t, "ana")

	for i := 0; i < 3; i++ {
		mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	}
	if got := e.Queue.Count(); got != 3 {
		t.Errorf("history events = %d, want 3", got)
	}

	for _, c := range [][2]float64{{91, 0}, {-91, 0}, {0, 181}, {0, -181}} {
		if err := e.Move(a, c[0], c[1]); !errors.Is(err, app.ErrBadLocation) {
			t.Errorf("Move(%v): got %v, want ErrBadLocation", c, err)
		}
	}
	if got := e.Queue.Count(); got != 3 {
		t.Errorf("rejected updates must not be recorded: count = %d", got)
	}
}

func TestSnapshot(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	a, b, c := e.AddUser(t, "ana"), e.AddUser(t, "bob"), e.AddUser(t, "cara")
	befriendClose(t, e, a, b)
	e.Befriend(t, a, c)
	mustMove(t, e, a, testenv.BaseLat, testenv.BaseLng)
	mustMove(t, e, b, testenv.BaseLat+testenv.Meters(50), testenv.BaseLng)
	mustMove(t, e, c, testenv.BaseLat+testenv.Meters(3000), testenv.BaseLng)

	list, err := e.App.Snapshot(ctx, a.UserID)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Username != "bob" {
		t.Fatalf("snapshot = %+v, want only bob", list)
	}
	if list[0].DistanceM%50 != 0 {
		t.Errorf("distance = %d, want about 50", list[0].DistanceM)
	}
}

func TestDeadConnectionsAreRemoved(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	a, b := e.AddUser(t, "ana"), e.AddUser(t, "bob")
	befriendClose(t, e, a, b)
	e.Pusher.MarkGone(a.ConnID)

	mustMove(t, e, b, testenv.BaseLat, testenv.BaseLng)
	mustMove(t, e, a, testenv.BaseLat+testenv.Meters(50), testenv.BaseLng) // triggers pushes to ana

	ids, err := e.Store.ConnectionIDsByUser(ctx, a.UserID)
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) != 0 {
		t.Errorf("gone connection should have been deleted, still have %v", ids)
	}
	// Bob is unaffected.
	expectTypes(t, "bob", e.Types(b), app.MsgFriendEnter)
}

func befriendClose(t *testing.T, e *testenv.Env, a, b *testenv.User) {
	t.Helper()
	e.Befriend(t, a, b)
	for _, pair := range [][2]*testenv.User{{a, b}, {b, a}} {
		d, err := e.Store.GetDocument(context.Background(), "user#"+pair[0].UserID, "profile")
		if err != nil {
			t.Fatal(err)
		}
		d.Data, _ = json.Marshal(map[string]any{"close": map[string]string{pair[1].UserID: "mutual"}, "visibilityRadiusM": 500, "radiusM": 500})
		if err = e.Store.CommitDocuments(context.Background(), []store.Document{d}); err != nil {
			t.Fatal(err)
		}
	}
}

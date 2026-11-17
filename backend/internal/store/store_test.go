package store_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
	"github.com/isaac-evs/friends_nearby/backend/internal/testenv"
)

func newUser(email, username string) *models.User {
	return &models.User{UserID: uuid.NewString(), Email: email, Username: username, DisplayName: username, RadiusM: 500}
}

func TestCreateUserUniqueness(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	first := newUser("ana@example.com", "ana")
	if err := e.Store.CreateUser(ctx, first); err != nil {
		t.Fatal(err)
	}

	// Same email in a different case, new username.
	err := e.Store.CreateUser(ctx, newUser("ANA@Example.com", "ana2"))
	if !errors.Is(err, store.ErrEmailTaken) {
		t.Errorf("duplicate email: got %v, want ErrEmailTaken", err)
	}
	// Same username in a different case, new email.
	err = e.Store.CreateUser(ctx, newUser("other@example.com", "ANA"))
	if !errors.Is(err, store.ErrUsernameTaken) {
		t.Errorf("duplicate username: got %v, want ErrUsernameTaken", err)
	}

	// A failed attempt must not leave markers behind: "other@example.com" is still free.
	if err := e.Store.CreateUser(ctx, newUser("other@example.com", "other")); err != nil {
		t.Errorf("email should still be free after a failed attempt: %v", err)
	}
	if id, _ := e.Store.UserIDByUsername(ctx, "ana2"); id != "" {
		t.Errorf("username ana2 leaked from a failed transaction")
	}

	if id, err := e.Store.UserIDByEmail(ctx, "  Ana@example.com "); err != nil || id != first.UserID {
		t.Errorf("UserIDByEmail = %q, %v; want %q", id, err, first.UserID)
	}
	if id, err := e.Store.UserIDByUsername(ctx, "ANA"); err != nil || id != first.UserID {
		t.Errorf("UserIDByUsername = %q, %v; want %q", id, err, first.UserID)
	}
	if id, _ := e.Store.UserIDByEmail(ctx, "nobody@example.com"); id != "" {
		t.Errorf("unknown email should return empty id, got %q", id)
	}
}

func TestGetUsersBatch(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	var ids []string
	for i := 0; i < 130; i++ { // more than one BatchGetItem chunk (100)
		u := newUser(uuid.NewString()+"@example.com", "u"+uuid.NewString()[:8])
		if err := e.Store.CreateUser(ctx, u); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, u.UserID)
	}
	got, err := e.Store.GetUsers(ctx, append(ids, "does-not-exist"))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 130 {
		t.Errorf("GetUsers returned %d users, want 130", len(got))
	}
}

func TestUpdateProfileIsPartial(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	u := newUser("ana@example.com", "ana")
	if err := e.Store.CreateUser(ctx, u); err != nil {
		t.Fatal(err)
	}
	radius, ghost := 1200, true
	got, err := e.Store.UpdateProfile(ctx, u.UserID, store.ProfilePatch{RadiusM: &radius, GhostMode: &ghost})
	if err != nil {
		t.Fatal(err)
	}
	if got.RadiusM != 1200 || !got.GhostMode || got.DisplayName != "ana" || got.Username != "ana" {
		t.Errorf("unexpected profile: %+v", got)
	}
	// An empty patch is a no-op that still returns the user.
	if got, err := e.Store.UpdateProfile(ctx, u.UserID, store.ProfilePatch{}); err != nil || got == nil || got.RadiusM != 1200 {
		t.Errorf("empty patch: %+v, %v", got, err)
	}
	// Updating a user that does not exist must fail instead of creating one.
	if _, err := e.Store.UpdateProfile(ctx, "ghost-user", store.ProfilePatch{RadiusM: &radius}); err == nil {
		t.Error("updating a missing user should fail")
	}
}

func TestFriendshipLifecycle(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	a, b := "user-a", "user-b"

	if err := e.Store.CreateRequest(ctx, a, b); err != nil {
		t.Fatal(err)
	}
	if err := e.Store.CreateRequest(ctx, a, b); !errors.Is(err, store.ErrAlreadyExists) {
		t.Errorf("repeat request: got %v, want ErrAlreadyExists", err)
	}
	if err := e.Store.CreateRequest(ctx, b, a); !errors.Is(err, store.ErrAlreadyExists) {
		t.Errorf("reverse request while pending: got %v, want ErrAlreadyExists", err)
	}

	fa, _ := e.Store.GetFriendship(ctx, a, b)
	fb, _ := e.Store.GetFriendship(ctx, b, a)
	if fa == nil || fa.Status != models.StatusPendingOut || fb == nil || fb.Status != models.StatusPendingIn {
		t.Fatalf("pending rows wrong: %+v / %+v", fa, fb)
	}
	if ids, _ := e.Store.AcceptedFriendIDs(ctx, a); len(ids) != 0 {
		t.Errorf("pending must not count as friends: %v", ids)
	}

	// The sender cannot accept their own request.
	if err := e.Store.Accept(ctx, a, b); !errors.Is(err, store.ErrNotPending) {
		t.Errorf("sender accept: got %v, want ErrNotPending", err)
	}
	if err := e.Store.Accept(ctx, b, a); err != nil {
		t.Fatal(err)
	}
	if err := e.Store.Accept(ctx, b, a); !errors.Is(err, store.ErrNotPending) {
		t.Errorf("second accept: got %v, want ErrNotPending", err)
	}
	for _, pair := range [][2]string{{a, b}, {b, a}} {
		ids, _ := e.Store.AcceptedFriendIDs(ctx, pair[0])
		if len(ids) != 1 || ids[0] != pair[1] {
			t.Errorf("%s friends = %v", pair[0], ids)
		}
	}

	if err := e.Store.DeleteFriendship(ctx, a, b); err != nil {
		t.Fatal(err)
	}
	if f, _ := e.Store.GetFriendship(ctx, a, b); f != nil {
		t.Error("row a->b should be gone")
	}
	if f, _ := e.Store.GetFriendship(ctx, b, a); f != nil {
		t.Error("row b->a should be gone")
	}
}

func TestConnections(t *testing.T) {
	e := testenv.New(t)
	ctx := context.Background()
	if err := e.Store.PutConnection(ctx, "c1", "u1"); err != nil {
		t.Fatal(err)
	}
	if err := e.Store.PutConnection(ctx, "c2", "u1"); err != nil {
		t.Fatal(err)
	}
	if err := e.Store.PutConnection(ctx, "c3", "u2"); err != nil {
		t.Fatal(err)
	}

	c, err := e.Store.GetConnection(ctx, "c1")
	if err != nil || c == nil || c.UserID != "u1" {
		t.Fatalf("GetConnection = %+v, %v", c, err)
	}
	if c, _ := e.Store.GetConnection(ctx, "missing"); c != nil {
		t.Errorf("missing connection should be nil, got %+v", c)
	}
	ids, _ := e.Store.ConnectionIDsByUser(ctx, "u1")
	if len(ids) != 2 {
		t.Errorf("u1 connections = %v, want 2", ids)
	}
	if err := e.Store.DeleteConnection(ctx, "c1"); err != nil {
		t.Fatal(err)
	}
	if ids, _ := e.Store.ConnectionIDsByUser(ctx, "u1"); len(ids) != 1 || ids[0] != "c2" {
		t.Errorf("after delete: %v", ids)
	}
}

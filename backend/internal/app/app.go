// Package app contains the business logic shared by the HTTP and WebSocket
// entry points: friends, ghost mode, and real-time nearby detection.
package app

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"time"

	"github.com/isaac-evs/friends_nearby/backend/internal/auth"
	"github.com/isaac-evs/friends_nearby/backend/internal/config"
	"github.com/isaac-evs/friends_nearby/backend/internal/location"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/ports"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

var (
	ErrGhostMode   = errors.New("location updates are disabled while ghost mode is on")
	ErrBadLocation = errors.New("lat must be in [-90,90] and lng in [-180,180]")
)

type App struct {
	Cfg       *config.Config
	Auth      *auth.Service
	Store     *store.Store
	Loc       *location.Store
	Pusher    ports.Pusher
	Queue     ports.Queue
	Presigner ports.Presigner
	Mailer    ports.Mailer
}

// Out-of-band messages pushed to clients over WebSocket.
const (
	MsgFriendEnter    = "friend_enter"
	MsgFriendLeave    = "friend_leave"
	MsgFriendRequest  = "friend_request"
	MsgFriendAccepted = "friend_accepted"
	MsgNearby         = "nearby"
	MsgError          = "error"
	MsgPong           = "pong"
)

type Message struct {
	Type     string             `json:"type"`
	Friend   *models.PublicUser `json:"friend,omitempty"`
	Distance *int               `json:"distance_m,omitempty"`
	Nearby   *[]NearbyFriend    `json:"nearby,omitempty"` // pointer so an empty list still serializes as []
	Error    string             `json:"error,omitempty"`
}

type NearbyFriend struct {
	models.PublicUser
	DistanceM int             `json:"distance_m"`
	Location  models.Location `json:"location"`
}

func (a *App) Public(u *models.User) models.PublicUser {
	p := models.PublicUser{UserID: u.UserID, Username: u.Username, DisplayName: u.DisplayName}
	if u.PhotoKey != "" && a.Cfg.CDNDomain != "" {
		p.PhotoURL = "https://" + a.Cfg.CDNDomain + "/" + u.PhotoKey
	}
	return p
}

// pushUser sends msg to every live connection of userID and drops dead ones.
// Delivery problems are logged, never returned: a missed notification must not
// fail the request that caused it.
func (a *App) pushUser(ctx context.Context, userID string, msg Message) {
	payload, err := json.Marshal(msg)
	if err != nil {
		slog.Error("marshal message", "err", err)
		return
	}
	ids, err := a.Store.ConnectionIDsByUser(ctx, userID)
	if err != nil {
		slog.Error("list connections", "user", userID, "err", err)
		return
	}
	for _, id := range ids {
		a.pushConn(ctx, id, payload)
	}
}

func (a *App) pushConn(ctx context.Context, connectionID string, payload []byte) {
	err := a.Pusher.Push(ctx, connectionID, payload)
	switch {
	case err == nil:
	case errors.Is(err, ports.ErrGone):
		if derr := a.Store.DeleteConnection(ctx, connectionID); derr != nil {
			slog.Error("delete stale connection", "conn", connectionID, "err", derr)
		}
	default:
		slog.Error("push", "conn", connectionID, "err", err)
	}
}

// PushToConnection sends a message to one specific connection (used for replies).
func (a *App) PushToConnection(ctx context.Context, connectionID string, msg Message) {
	payload, err := json.Marshal(msg)
	if err != nil {
		return
	}
	a.pushConn(ctx, connectionID, payload)
}

// HandleLocation records a location update and sends enter/leave events.
func (a *App) HandleLocation(ctx context.Context, userID string, loc models.Location) error {
	if loc.Lat < -90 || loc.Lat > 90 || loc.Lng < -180 || loc.Lng > 180 ||
		math.IsNaN(loc.Lat) || math.IsNaN(loc.Lng) {
		return ErrBadLocation
	}
	me, err := a.Store.GetUser(ctx, userID)
	if err != nil {
		return err
	}
	if me == nil {
		return errors.New("user not found")
	}
	if me.GhostMode {
		return ErrGhostMode
	}
	loc.TS = time.Now().UnixMilli()

	if err := a.Loc.Set(ctx, userID, loc); err != nil {
		return err
	}
	a.recordHistory(ctx, userID, loc)

	friendIDs, err := a.Store.AcceptedFriendIDs(ctx, userID)
	if err != nil || len(friendIDs) == 0 {
		return err
	}
	friends, err := a.Store.GetUsers(ctx, friendIDs)
	if err != nil {
		return err
	}
	locs, err := a.Loc.GetMany(ctx, friendIDs)
	if err != nil {
		return err
	}

	for _, fid := range friendIDs {
		f := friends[fid]
		if f == nil {
			continue
		}
		blocked, err := a.Store.IsBlocked(ctx, userID, fid)
		if err != nil {
			return err
		}
		floc, ok := locs[fid]
		present := ok && !f.GhostMode && !blocked
		var dist float64
		if present {
			dist = location.DistanceM(loc, floc)
		}
		// What I see about my friend, using my radius.
		if err := a.transition(ctx, me.UserID, f, present && dist <= float64(me.RadiusM), dist); err != nil {
			return err
		}
		// What my friend sees about me, using their radius.
		if err := a.transition(ctx, f.UserID, me, present && dist <= float64(f.RadiusM), dist); err != nil {
			return err
		}
	}
	return nil
}

// transition updates viewer's near-set for other and notifies the viewer only
// when other enters or leaves the viewer's radius.
func (a *App) transition(ctx context.Context, viewerID string, other *models.User, near bool, dist float64) error {
	was, err := a.Loc.IsNear(ctx, viewerID, other.UserID)
	if err != nil {
		return err
	}
	switch {
	case near && !was:
		if err := a.Loc.AddNear(ctx, viewerID, other.UserID); err != nil {
			return err
		}
		pub := a.Public(other)
		d := int(math.Round(dist))
		a.pushUser(ctx, viewerID, Message{Type: MsgFriendEnter, Friend: &pub, Distance: &d})
	case near && was:
		// Still nearby: no message, just keep the state from expiring.
		return a.Loc.AddNear(ctx, viewerID, other.UserID)
	case !near && was:
		if err := a.Loc.RemoveNear(ctx, viewerID, other.UserID); err != nil {
			return err
		}
		pub := a.Public(other)
		a.pushUser(ctx, viewerID, Message{Type: MsgFriendLeave, Friend: &pub})
	}
	return nil
}

func (a *App) recordHistory(ctx context.Context, userID string, loc models.Location) {
	body, err := json.Marshal(models.HistoryEvent{
		Type: "location", UserID: userID, Lat: loc.Lat, Lng: loc.Lng, TS: loc.TS, At: time.UnixMilli(loc.TS).UTC(),
	})
	if err == nil {
		err = a.Queue.Send(ctx, body)
	}
	if err != nil {
		slog.Error("enqueue history event", "user", userID, "err", err)
	}
}

// EnterGhost hides userID from all friends and clears their own nearby view.
func (a *App) EnterGhost(ctx context.Context, me *models.User) error {
	if err := a.Loc.Delete(ctx, me.UserID); err != nil {
		return err
	}
	// Tell friends who currently see me that I left.
	friendIDs, err := a.Store.AcceptedFriendIDs(ctx, me.UserID)
	if err != nil {
		return err
	}
	for _, fid := range friendIDs {
		if err := a.dropNear(ctx, fid, me); err != nil {
			return err
		}
	}
	// Clear my own view so my client does not keep showing stale friends.
	mine, err := a.Loc.NearIDs(ctx, me.UserID)
	if err != nil {
		return err
	}
	if len(mine) > 0 {
		users, err := a.Store.GetUsers(ctx, mine)
		if err != nil {
			return err
		}
		for _, id := range mine {
			if u := users[id]; u != nil {
				if err := a.dropNear(ctx, me.UserID, u); err != nil {
					return err
				}
			}
		}
	}
	return a.Loc.DeleteNear(ctx, me.UserID)
}

// dropNear removes other from viewer's near-set, sending a leave event if needed.
func (a *App) dropNear(ctx context.Context, viewerID string, other *models.User) error {
	was, err := a.Loc.IsNear(ctx, viewerID, other.UserID)
	if err != nil || !was {
		return err
	}
	if err := a.Loc.RemoveNear(ctx, viewerID, other.UserID); err != nil {
		return err
	}
	pub := a.Public(other)
	a.pushUser(ctx, viewerID, Message{Type: MsgFriendLeave, Friend: &pub})
	return nil
}

// CleanupPair clears nearby state between two users (used on unfriend).
func (a *App) CleanupPair(ctx context.Context, x, y *models.User) error {
	if err := a.dropNear(ctx, x.UserID, y); err != nil {
		return err
	}
	return a.dropNear(ctx, y.UserID, x)
}

// Snapshot lists the friends currently inside userID's radius.
func (a *App) Snapshot(ctx context.Context, userID string) ([]NearbyFriend, error) {
	mine, err := a.Loc.Get(ctx, userID)
	if err != nil || mine == nil {
		return []NearbyFriend{}, err
	}
	ids, err := a.Loc.NearIDs(ctx, userID)
	if err != nil || len(ids) == 0 {
		return []NearbyFriend{}, err
	}
	users, err := a.Store.GetUsers(ctx, ids)
	if err != nil {
		return nil, err
	}
	locs, err := a.Loc.GetMany(ctx, ids)
	if err != nil {
		return nil, err
	}
	result := make([]NearbyFriend, 0, len(ids))
	for _, id := range ids {
		u := users[id]
		if u == nil || u.GhostMode {
			continue
		}
		blocked, err := a.Store.IsBlocked(ctx, userID, id)
		if err != nil {
			return nil, err
		}
		f, err := a.Store.GetFriendship(ctx, userID, id)
		if err != nil {
			return nil, err
		}
		if blocked || f == nil || f.Status != models.StatusAccepted {
			continue
		}
		fl, ok := locs[id]
		if !ok {
			continue
		}
		result = append(result, NearbyFriend{
			PublicUser: a.Public(u),
			DistanceM:  int(math.Round(location.DistanceM(*mine, fl))),
			Location:   models.Location{Lat: math.Round(fl.Lat/0.002) * 0.002, Lng: math.Round(fl.Lng/0.002) * 0.002, TS: fl.TS},
		})
	}
	return result, nil
}

// NotifyChange invalidates the projection on all of a user's active clients.
func (a *App) NotifyChange(ctx context.Context, userID string) {
	a.pushUser(ctx, userID, Message{Type: "state_changed"})
}

func (a *App) NotifyWave(ctx context.Context, userID string, from *models.User) {
	p := a.Public(from)
	a.pushUser(ctx, userID, Message{Type: "wave", Friend: &p})
}

// NotifyFriendRequest and NotifyFriendAccepted push in-app notifications.
func (a *App) NotifyFriendRequest(ctx context.Context, to string, from *models.User) {
	pub := a.Public(from)
	a.pushUser(ctx, to, Message{Type: MsgFriendRequest, Friend: &pub})
}

func (a *App) NotifyFriendAccepted(ctx context.Context, to string, by *models.User) {
	pub := a.Public(by)
	a.pushUser(ctx, to, Message{Type: MsgFriendAccepted, Friend: &pub})
}

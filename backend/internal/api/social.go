package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/isaac-evs/friends_nearby/backend/internal/location"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

type point struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}
type zone struct {
	Name     string `json:"name"`
	Center   point  `json:"center"`
	RadiusM  int    `json:"radiusM"`
	Distance int    `json:"approxDistanceM"`
}
type openMode struct {
	Enabled bool `json:"enabled"`
	Adult   bool `json:"adult"`
	Big     bool `json:"bigEvents"`
	Small   bool `json:"smallPlans"`
}
type chosenLocation struct {
	Status   string `json:"status"`
	ZoneName string `json:"zoneName"`
	Center   *point `json:"center,omitempty"`
}
type xpEvent struct {
	ID     string `json:"id"`
	Amount int    `json:"amount"`
	Reason string `json:"reason"`
	At     string `json:"at"`
}
type personal struct {
	Roomies  []string          `json:"roomies"`
	Location chosenLocation    `json:"location"`
	Open     openMode          `json:"openMode"`
	Ranking  bool              `json:"rankingOptIn"`
	XP       int               `json:"xp"`
	Level    int               `json:"level"`
	Hangouts int               `json:"hangouts"`
	Streak   int               `json:"streakWeeks"`
	Events   int               `json:"eventsCount"`
	LastWeek string            `json:"lastWeek"`
	Zones    []string          `json:"zones"`
	Rewards  []xpEvent         `json:"xpEvents"`
	Swipes   map[string]string `json:"swipes"`
	Blocks   []string          `json:"blocks"`
	Waved    []string          `json:"waved"`
	Draft    json.RawMessage   `json:"eventDraft"`
}
type socialPlan struct {
	ID       string `json:"id"`
	Author   string `json:"authorId"`
	Category string `json:"category"`
	Line     string `json:"line"`
	Expires  string `json:"expiresAt"`
	Audience string `json:"audience"`
	Zone     zone   `json:"zone"`
	Joined   int    `json:"joinedCount"`
	Updated  string `json:"zoneUpdatedAt"`
	Meet     string `json:"meetPoint"`
}
type attendance struct {
	User     string `json:"userId,omitempty"`
	Event    string `json:"eventId"`
	Pace     string `json:"pace,omitempty"`
	Joined   string `json:"joinedAt"`
	Status   string `json:"status"`
	Rewarded bool   `json:"rewarded"`
}
type socialEvent struct {
	ID        string                `json:"id"`
	Owner     string                `json:"ownerId"`
	Type      string                `json:"type"`
	Subtype   string                `json:"subtype"`
	Title     string                `json:"title"`
	Starts    string                `json:"startsAt"`
	Place     string                `json:"placeName"`
	Center    point                 `json:"center"`
	Distance  int                   `json:"approxDistanceM"`
	Capacity  int                   `json:"capacity"`
	Going     int                   `json:"going"`
	Organizer map[string]any        `json:"organizer"`
	Audience  string                `json:"audience"`
	Approval  bool                  `json:"requiresApproval"`
	Friends   []string              `json:"friendsGoingIds"`
	XP        int                   `json:"xp"`
	Paces     []string              `json:"paces,omitempty"`
	Members   map[string]attendance `json:"members"`
}
type socialMatch struct {
	ID        string            `json:"id"`
	PlanID    string            `json:"planId"`
	Host      string            `json:"hostId"`
	Guest     string            `json:"guestId"`
	Created   string            `json:"createdAt"`
	Until     string            `json:"exactShareUntil"`
	Meet      string            `json:"meetPoint"`
	Messages  map[string]string `json:"messages"`
	Confirmed map[string]bool   `json:"confirmed"`
	Rewarded  bool              `json:"rewarded"`
	Plan      socialPlan        `json:"plan"`
}
type socialAction struct {
	Type      string          `json:"type"`
	ID        string          `json:"id"`
	Kind      string          `json:"kind"`
	Action    string          `json:"action"`
	UserID    string          `json:"userId"`
	Message   string          `json:"message"`
	Reason    string          `json:"reason"`
	Category  string          `json:"category"`
	Line      string          `json:"line"`
	Duration  int             `json:"durationMin"`
	Audience  string          `json:"audience"`
	Title     string          `json:"title"`
	Starts    string          `json:"startsAt"`
	Place     string          `json:"placeName"`
	Capacity  int             `json:"capacity"`
	Approval  bool            `json:"requiresApproval"`
	EventType string          `json:"eventType"`
	Pace      string          `json:"pace"`
	Location  *chosenLocation `json:"location"`
	Open      *openMode       `json:"openMode"`
	Draft     json.RawMessage `json:"draft"`
	Center    *point          `json:"center"`
}

type socialTx struct {
	h     *Handler
	r     *request
	docs  map[string]store.Document
	dirty map[string]bool
}

func newSocialTx(h *Handler, r *request) *socialTx {
	return &socialTx{h: h, r: r, docs: map[string]store.Document{}, dirty: map[string]bool{}}
}
func (t *socialTx) load(pk, sk string, v any) error {
	key := pk + "/" + sk
	d, ok := t.docs[key]
	if !ok {
		var err error
		d, err = t.h.App.Store.GetDocument(t.r.ctx, pk, sk)
		if err != nil {
			return err
		}
		t.docs[key] = d
	}
	if len(d.Data) > 0 {
		return json.Unmarshal(d.Data, v)
	}
	return nil
}
func (t *socialTx) save(pk, sk string, v any) error {
	key := pk + "/" + sk
	d, ok := t.docs[key]
	if !ok {
		if err := t.load(pk, sk, &json.RawMessage{}); err != nil {
			return err
		}
		d = t.docs[key]
	}
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	d.Data = b
	t.docs[key] = d
	t.dirty[key] = true
	return nil
}
func (t *socialTx) person(id string) (personal, error) {
	p := personal{Location: chosenLocation{Status: "unknown", ZoneName: "Chapultepec"}, Open: openMode{Big: true}, Level: 1, Swipes: map[string]string{}, Blocks: []string{}, Waved: []string{}, Rewards: []xpEvent{}, Zones: []string{}}
	err := t.load("user#"+id, "profile", &p)
	return p, err
}
func (t *socialTx) commit() error {
	docs := []store.Document{}
	for k := range t.dirty {
		docs = append(docs, t.docs[k])
	}
	return t.h.App.Store.CommitDocuments(t.r.ctx, docs)
}

func (t *socialTx) prefetchProfiles(ids []string) error {
	keys := []store.Document{}
	seen := map[string]bool{}
	for _, id := range ids {
		key := "user#" + id + "/profile"
		if _, ok := t.docs[key]; ok || seen[id] {
			continue
		}
		seen[id] = true
		keys = append(keys, store.Document{PK: "user#" + id, SK: "profile"})
	}
	docs, err := t.h.App.Store.GetDocuments(t.r.ctx, keys)
	if err != nil {
		return err
	}
	for _, d := range keys {
		t.docs[d.PK+"/"+d.SK] = d
	}
	for _, d := range docs {
		t.docs[d.PK+"/"+d.SK] = d
	}
	return nil
}
func contains(a []string, s string) bool {
	for _, x := range a {
		if x == s {
			return true
		}
	}
	return false
}
func validChoice(v, choices string) bool { return contains(strings.Split(choices, ","), v) }
func approximate(p point) point {
	return point{math.Round(p.Lat/0.002) * 0.002, math.Round(p.Lng/0.002) * 0.002}
}
func validPoint(p point) bool {
	return !math.IsNaN(p.Lat) && !math.IsNaN(p.Lng) && p.Lat >= -90 && p.Lat <= 90 && p.Lng >= -180 && p.Lng <= 180
}
func nowISO() string { return time.Now().UTC().Format(time.RFC3339Nano) }
func active(s string) bool {
	t, e := time.Parse(time.RFC3339Nano, s)
	return e == nil && t.After(time.Now())
}
func weekKey() string { y, w := time.Now().UTC().ISOWeek(); return fmt.Sprintf("%04d-%02d", y, w) }
func reward(p *personal, amount int, reason, id string) {
	for _, x := range p.Rewards {
		if x.ID == id {
			return
		}
	}
	p.XP += amount
	for p.XP >= 500 {
		p.XP -= 500
		p.Level++
	}
	p.Rewards = append(p.Rewards, xpEvent{ID: id, Amount: amount, Reason: reason, At: nowISO()})
	// Bound the profile item; lifetime totals are stored separately above.
	if len(p.Rewards) > 500 {
		p.Rewards = p.Rewards[len(p.Rewards)-500:]
	}
}
func (t *socialTx) blocked(a, b string) (bool, error) {
	p, e := t.person(a)
	if e != nil {
		return false, e
	}
	q, e := t.person(b)
	return contains(p.Blocks, b) || contains(q.Blocks, a), e
}
func (t *socialTx) friends(a, b string) (bool, error) {
	f, e := t.h.App.Store.GetFriendship(t.r.ctx, a, b)
	return f != nil && f.Status == models.StatusAccepted, e
}
func (t *socialTx) allowEvent(e socialEvent, id string) (bool, error) {
	blocked, err := t.blocked(id, e.Owner)
	if err != nil || blocked {
		return false, err
	}
	if id == e.Owner {
		return true, nil
	}
	p, err := t.person(id)
	if err != nil {
		return false, err
	}
	if e.Audience == "abierto" {
		return p.Open.Enabled && p.Open.Adult, nil
	}
	yes, err := t.friends(id, e.Owner)
	if err != nil || yes || e.Audience != "amigos+" {
		return yes, err
	}
	ids, err := t.h.App.Store.AcceptedFriendIDs(t.r.ctx, id)
	if err != nil {
		return false, err
	}
	for _, fid := range ids {
		yes, err = t.friends(fid, e.Owner)
		if err != nil || yes {
			return yes, err
		}
	}
	return false, nil
}
func (t *socialTx) userView(u *models.User) (map[string]any, error) {
	p, err := t.person(u.UserID)
	if err != nil {
		return nil, err
	}
	weekly := 0
	year, week := time.Now().UTC().ISOWeek()
	for _, x := range p.Rewards {
		dt, e := time.Parse(time.RFC3339Nano, x.At)
		y, w := dt.ISOWeek()
		if e == nil && y == year && w == week {
			weekly += x.Amount
		}
	}
	if u.UserID != t.r.userID && !p.Ranking {
		weekly = 0
	}
	return map[string]any{"id": u.UserID, "name": u.DisplayName, "handle": "@" + u.Username, "photoUrl": t.h.App.Public(u).PhotoURL, "level": p.Level, "streakWeeks": p.Streak, "hangouts": p.Hangouts, "eventsCount": p.Events, "rankingOptIn": p.Ranking, "weeklyXp": weekly}, nil
}

// appState is a server-filtered projection of the existing React store. Exact
// coordinates live only in Redis and are returned exclusively for active matches.
func (h *Handler) appState(r *request) httpResp {
	state, err := h.buildState(r)
	if err != nil {
		return internalError("app state", err)
	}
	return respond(200, state)
}

func (h *Handler) socialUser(r *request) httpResp {
	id := r.ev.QueryStringParameters["id"]
	if id == "" {
		var err error
		id, err = h.App.Store.UserIDByUsername(r.ctx, strings.TrimPrefix(r.ev.QueryStringParameters["username"], "@"))
		if err != nil {
			return internalError("lookup user", err)
		}
	}
	if id == "" {
		return respond(404, errBody("user not found"))
	}
	t := newSocialTx(h, r)
	b, err := t.blocked(r.userID, id)
	if err != nil {
		return internalError("check block", err)
	}
	if b {
		return respond(404, errBody("user not found"))
	}
	u, err := h.App.Store.GetUser(r.ctx, id)
	if err != nil {
		return internalError("get user", err)
	}
	if u == nil {
		return respond(404, errBody("user not found"))
	}
	v, err := t.userView(u)
	if err != nil {
		return internalError("user view", err)
	}
	return respond(200, v)
}
func (h *Handler) buildState(r *request) (map[string]any, error) {
	t := newSocialTx(h, r)
	p, err := t.person(r.userID)
	if err != nil {
		return nil, err
	}
	me, err := h.App.Store.GetUser(r.ctx, r.userID)
	if err != nil {
		return nil, err
	}
	if me == nil {
		return nil, errors.New("user not found")
	}
	users := map[string]any{}
	userCache := map[string]*models.User{r.userID: me}
	prefetchUsers := func(ids []string) error {
		unique := []string{}
		seen := map[string]bool{}
		for _, id := range ids {
			if _, ok := userCache[id]; !ok && !seen[id] {
				unique = append(unique, id)
				seen[id] = true
			}
		}
		found, e := h.App.Store.GetUsers(r.ctx, unique)
		if e != nil {
			return e
		}
		for _, id := range unique {
			userCache[id] = found[id]
		}
		return nil
	}
	friendships := map[string]any{}
	plans := []socialPlan{}
	events := []socialEvent{}
	matches := []map[string]any{}
	attendances := []attendance{}
	exact := map[string]point{}
	attendees := map[string][]string{}
	pending := map[string][]string{}
	addUser := func(id string) error {
		if _, ok := users[id]; ok {
			return nil
		}
		b, e := t.blocked(r.userID, id)
		if e != nil || b {
			return e
		}
		u, ok := userCache[id]
		if !ok {
			var e error
			u, e = h.App.Store.GetUser(r.ctx, id)
			if e != nil {
				return e
			}
			userCache[id] = u
		}
		if u == nil {
			return nil
		}
		v, e := t.userView(u)
		if e == nil {
			users[id] = v
		}
		return e
	}
	if err = addUser(r.userID); err != nil {
		return nil, err
	}
	rows, err := h.App.Store.ListFriendships(r.ctx, r.userID)
	if err != nil {
		return nil, err
	}
	friendIDs := []string{}
	for _, f := range rows {
		friendIDs = append(friendIDs, f.FriendID)
	}
	if err = t.prefetchProfiles(friendIDs); err != nil {
		return nil, err
	}
	if err = prefetchUsers(friendIDs); err != nil {
		return nil, err
	}
	for _, f := range rows {
		b, e := t.blocked(r.userID, f.FriendID)
		if e != nil {
			return nil, e
		}
		if b {
			continue
		}
		if e = addUser(f.FriendID); e != nil {
			return nil, e
		}
		u := userCache[f.FriendID]
		if u == nil {
			continue
		}
		loc, e := h.App.Loc.Get(r.ctx, f.FriendID)
		if e != nil {
			return nil, e
		}
		status := map[string]string{models.StatusAccepted: "friends", models.StatusPendingIn: "requested_in", models.StatusPendingOut: "requested_out"}[f.Status]
		mutual := []string{}
		if f.Status == models.StatusAccepted {
			ids, e := h.App.Store.AcceptedFriendIDs(r.ctx, f.FriendID)
			if e != nil {
				return nil, e
			}
			for _, row := range rows {
				if row.Status == models.StatusAccepted && contains(ids, row.FriendID) {
					blocked, e := t.blocked(r.userID, row.FriendID)
					if e != nil {
						return nil, e
					}
					if !blocked {
						mutual = append(mutual, row.FriendID)
					}
				}
			}
		}
		friendships[f.FriendID] = map[string]any{"userId": f.FriendID, "status": status, "mutualFriendIds": mutual, "locationPaused": u.GhostMode || loc == nil}
	}
	// A single current plan per author; no table scans or fabricated plan cards.
	ids := []string{r.userID}
	for _, f := range rows {
		if f.Status == models.StatusAccepted {
			ids = append(ids, f.FriendID)
		}
	}
	mine, err := h.App.Loc.Get(r.ctx, r.userID)
	if err != nil {
		return nil, err
	}
	if mine != nil {
		center := approximate(point{mine.Lat, mine.Lng})
		p.Location.Center = &center
	}
	for _, id := range ids {
		if _, ok := users[id]; !ok {
			continue
		}
		var plan socialPlan
		if err = t.load("user#"+id, "plan", &plan); err != nil {
			return nil, err
		}
		if plan.ID == "" || !active(plan.Expires) {
			continue
		}
		if id != r.userID {
			owner, e := t.person(id)
			if e != nil {
				return nil, e
			}
			if plan.Audience == "roomies" && !contains(owner.Roomies, r.userID) {
				continue
			}
			if plan.Audience == "abierto" && (!p.Open.Enabled || !p.Open.Adult || !p.Open.Small) {
				continue
			}
		}
		u := userCache[id]
		if id != r.userID && (u == nil || u.GhostMode) {
			continue
		}
		loc, e := h.App.Loc.Get(r.ctx, id)
		if e != nil {
			return nil, e
		}
		if id != r.userID && loc == nil {
			continue
		}
		if loc != nil {
			plan.Zone.Center = approximate(point{loc.Lat, loc.Lng})
			plan.Updated = time.UnixMilli(loc.TS).UTC().Format(time.RFC3339Nano)
		}
		if mine != nil && loc != nil {
			plan.Zone.Distance = int(math.Round(location.DistanceM(*mine, *loc)))
		}
		plans = append(plans, plan)
	}
	docs, err := h.App.Store.ListDocuments(r.ctx, "events")
	if err != nil {
		return nil, err
	}
	eventUsers := []string{}
	for _, d := range docs {
		var ev socialEvent
		if err = json.Unmarshal(d.Data, &ev); err != nil {
			return nil, err
		}
		if active(ev.Starts) {
			eventUsers = append(eventUsers, ev.Owner)
			for uid := range ev.Members {
				eventUsers = append(eventUsers, uid)
			}
		}
	}
	if err = t.prefetchProfiles(eventUsers); err != nil {
		return nil, err
	}
	if err = prefetchUsers(eventUsers); err != nil {
		return nil, err
	}
	for _, d := range docs {
		var ev socialEvent
		if err = json.Unmarshal(d.Data, &ev); err != nil {
			return nil, err
		}
		if ev.ID == "" || !active(ev.Starts) {
			continue
		}
		ok, e := t.allowEvent(ev, r.userID)
		if e != nil {
			return nil, e
		}
		if !ok {
			continue
		}
		if ev.Owner != r.userID && ev.Audience == "abierto" && !p.Open.Big {
			continue
		}
		if e = addUser(ev.Owner); e != nil {
			return nil, e
		}
		ev.Friends = []string{}
		attendees[ev.ID] = []string{}
		pending[ev.ID] = []string{}
		for uid, a := range ev.Members {
			b, e := t.blocked(r.userID, uid)
			if e != nil {
				return nil, e
			}
			if b {
				continue
			}
			if uid == r.userID && a.Status != "left" {
				a.User = ""
				attendances = append(attendances, a)
			}
			if a.Status == "going" {
				if e = addUser(uid); e != nil {
					return nil, e
				}
				attendees[ev.ID] = append(attendees[ev.ID], uid)
				if f, ok := friendships[uid].(map[string]any); ok && f["status"] == "friends" {
					ev.Friends = append(ev.Friends, uid)
				}
			} else if ev.Owner == r.userID && a.Status == "pending" {
				pending[ev.ID] = append(pending[ev.ID], uid)
				if e = addUser(uid); e != nil {
					return nil, e
				}
			}
		}
		if ev.Owner == r.userID {
			ev.Organizer = map[string]any{"name": "Tú", "verified": false, "eventsCount": p.Events}
		}
		if p.Location.Center != nil {
			ev.Distance = int(location.DistanceM(models.Location{Lat: p.Location.Center.Lat, Lng: p.Location.Center.Lng}, models.Location{Lat: ev.Center.Lat, Lng: ev.Center.Lng}))
		}
		ev.Members = nil
		events = append(events, ev)
	}
	pointers, err := h.App.Store.ListDocuments(r.ctx, "user#"+r.userID)
	if err != nil {
		return nil, err
	}
	for _, d := range pointers {
		if !strings.HasPrefix(d.SK, "match#") {
			continue
		}
		var m socialMatch
		if err = t.load(d.SK, "data", &m); err != nil {
			return nil, err
		}
		if m.ID == "" {
			continue
		}
		other := m.Host
		if other == r.userID {
			other = m.Guest
		}
		b, e := t.blocked(r.userID, other)
		if e != nil {
			return nil, e
		}
		if b {
			continue
		}
		if e = addUser(other); e != nil {
			return nil, e
		}
		matches = append(matches, map[string]any{"id": m.ID, "planId": m.PlanID, "friendId": other, "createdAt": m.Created, "exactShareUntil": m.Until, "meetPoint": m.Meet, "quickMessage": m.Messages[r.userID], "receivedMessage": m.Messages[other], "myConfirmed": m.Confirmed[r.userID], "theirConfirmed": m.Confirmed[other], "rewarded": m.Rewarded})
		found := false
		for _, plan := range plans {
			if plan.ID == m.PlanID {
				found = true
			}
		}
		if !found {
			plans = append(plans, m.Plan)
		}
		u, e := h.App.Store.GetUser(r.ctx, other)
		if e != nil {
			return nil, e
		}
		isFriend, e := t.friends(r.userID, other)
		if e != nil {
			return nil, e
		}
		if active(m.Until) && isFriend && !me.GhostMode && u != nil && !u.GhostMode {
			loc, e := h.App.Loc.Get(r.ctx, other)
			if e != nil {
				return nil, e
			}
			if loc != nil {
				exact[other] = point{loc.Lat, loc.Lng}
			}
		}
	}
	sort.Slice(events, func(i, j int) bool { return events[i].Starts < events[j].Starts })
	sort.Slice(plans, func(i, j int) bool { return plans[i].ID < plans[j].ID })
	badges := []map[string]any{
		{"id": "primer-jale", "label": "Primer jale", "icon": "star", "tile": "bg-cat-comer", "earned": p.Hangouts > 0},
		{"id": "anfitrion", "label": "Anfitrión", "icon": "users", "tile": "bg-cat-otro", "earned": p.Events >= 3, "progress": map[string]int{"current": p.Events, "goal": 3}},
		{"id": "racha-10", "label": "Racha 10", "icon": "flame", "tile": "bg-cat-musica", "earned": p.Streak >= 10, "progress": map[string]int{"current": p.Streak, "goal": 10}},
	}
	return map[string]any{"session": map[string]string{"email": me.Email, "userId": me.UserID}, "location": p.Location, "ghost": me.GhostMode, "openMode": p.Open, "xp": p.XP, "xpGoal": 500, "users": users, "friendships": friendships, "plans": plans, "events": events, "swipes": p.Swipes, "matches": matches, "attendances": attendances, "xpEvents": p.Rewards, "blocks": p.Blocks, "reports": []any{}, "waved": p.Waved, "eventDraft": p.Draft, "exactLocations": exact, "eventAttendees": attendees, "pendingAttendees": pending, "badges": badges, "zonesCount": len(p.Zones), "roomies": append([]string{}, p.Roomies...)}, nil
}

func (h *Handler) socialAction(r *request) httpResp {
	var in socialAction
	if err := r.decode(&in); err != nil {
		return respond(400, errBody(err.Error()))
	}
	t := newSocialTx(h, r)
	p, err := t.person(r.userID)
	if err != nil {
		return internalError("load profile", err)
	}
	result, code, err := h.applySocial(t, &p, in)
	if err != nil {
		if code == 500 {
			return internalError("social action", err)
		}
		return respond(code, errBody(err.Error()))
	}
	if err = t.save("user#"+r.userID, "profile", p); err != nil {
		return internalError("save profile", err)
	}
	if err = t.commit(); err != nil {
		if errors.Is(err, store.ErrConflict) {
			return respond(409, errBody(err.Error()))
		}
		return internalError("commit social action", err)
	}
	if in.Type == "block" {
		users, e := h.App.Store.GetUsers(r.ctx, []string{r.userID, in.UserID})
		if e != nil {
			return internalError("block cleanup", e)
		}
		if users[r.userID] != nil && users[in.UserID] != nil {
			if e = h.App.CleanupPair(r.ctx, users[r.userID], users[in.UserID]); e != nil {
				return internalError("block cleanup", e)
			}
		}
		h.App.NotifyChange(r.ctx, in.UserID)
	}
	h.App.NotifyChange(r.ctx, r.userID)
	if in.Type == "setLocation" && in.Location != nil && in.Location.Status != "granted" {
		u, e := h.App.Store.GetUser(r.ctx, r.userID)
		if e != nil {
			return internalError("clear location", e)
		}
		if u != nil {
			if e = h.App.EnterGhost(r.ctx, u); e != nil {
				return internalError("clear location", e)
			}
		}
	}
	if in.Type == "wave" {
		u, e := h.App.Store.GetUser(r.ctx, r.userID)
		if e == nil && u != nil {
			h.App.NotifyWave(r.ctx, in.UserID, u)
		}
	}
	ids, e := h.App.Store.AcceptedFriendIDs(r.ctx, r.userID)
	if e == nil {
		for _, id := range ids {
			h.App.NotifyChange(r.ctx, id)
		}
	}
	return respond(200, map[string]any{"result": result})
}
func (h *Handler) applySocial(t *socialTx, p *personal, in socialAction) (any, int, error) {
	bad := func(s string) (any, int, error) { return nil, 400, errors.New(s) }
	fail := func(e error) (any, int, error) { return nil, 500, e }
	deny := func() (any, int, error) { return nil, 403, errors.New("not allowed") }
	id := t.r.userID
	pk := "user#" + id
	switch in.Type {
	case "setLocation":
		if in.Location == nil || !validChoice(in.Location.Status, "granted,denied,manual") || strings.TrimSpace(in.Location.ZoneName) == "" || len(in.Location.ZoneName) > 80 {
			return bad("invalid location preference")
		}
		if in.Location.Center != nil {
			if !validPoint(*in.Location.Center) {
				return bad("invalid zone")
			}
			c := approximate(*in.Location.Center)
			in.Location.Center = &c
		}
		p.Location = *in.Location
		if !contains(p.Zones, p.Location.ZoneName) {
			p.Zones = append(p.Zones, p.Location.ZoneName)
		}
	case "setOpenMode":
		if in.Open == nil {
			return bad("openMode is required")
		}
		if in.Open.Enabled && !in.Open.Adult {
			return bad("adult consent is required")
		}
		p.Open = *in.Open
	case "toggleRanking":
		p.Ranking = !p.Ranking
	case "toggleRoomie":
		ok, e := t.friends(id, in.UserID)
		if e != nil {
			return fail(e)
		}
		if !ok {
			return deny()
		}
		if contains(p.Roomies, in.UserID) {
			next := []string{}
			for _, v := range p.Roomies {
				if v != in.UserID {
					next = append(next, v)
				}
			}
			p.Roomies = next
		} else {
			if len(p.Roomies) >= 100 {
				return bad("roomie limit reached")
			}
			p.Roomies = append(p.Roomies, in.UserID)
		}
	case "saveDraft":
		if len(in.Draft) > 4096 {
			return bad("draft too large")
		}
		p.Draft = in.Draft
	case "swipe":
		if !validChoice(in.Kind, "plan,event") || !validChoice(in.Action, "pass,later") {
			return bad("invalid swipe")
		}
		if len(p.Swipes) >= 1000 {
			return bad("saved swipe limit reached")
		}
		p.Swipes[in.Kind+":"+in.ID] = in.Action
	case "resetSwipes":
		for k, v := range p.Swipes {
			if strings.HasPrefix(k, in.Kind+":") && v == "pass" {
				delete(p.Swipes, k)
			}
		}
	case "publishPlan":
		if !validChoice(in.Category, "cafe,comer,correr,estudiar,gym,chill,antro,juegos") || len(strings.TrimSpace(in.Line)) < 3 || len(in.Line) > 280 || in.Duration < 1 || in.Duration > 1440 || !validChoice(in.Audience, "amigos,roomies,abierto") {
			return bad("invalid plan")
		}
		if in.Audience == "abierto" && (!p.Open.Enabled || !p.Open.Adult) {
			return deny()
		}
		if p.Location.Center == nil {
			return bad("choose a location first")
		}
		plan := socialPlan{ID: id + ":" + uuid.NewString(), Author: id, Category: in.Category, Line: strings.TrimSpace(in.Line), Expires: time.Now().Add(time.Duration(in.Duration) * time.Minute).UTC().Format(time.RFC3339Nano), Audience: in.Audience, Zone: zone{Name: p.Location.ZoneName, Center: approximate(*p.Location.Center), RadiusM: 500}, Updated: nowISO(), Meet: p.Location.ZoneName}
		if err := t.save(pk, "plan", plan); err != nil {
			return fail(err)
		}
		return plan, 200, nil
	case "removePlan":
		var plan socialPlan
		if err := t.load(pk, "plan", &plan); err != nil {
			return fail(err)
		}
		if plan.ID != in.ID {
			return bad("plan not found")
		}
		if err := t.save(pk, "plan", socialPlan{}); err != nil {
			return fail(err)
		}
	case "publishEvent":
		dt, e := time.Parse(time.RFC3339Nano, in.Starts)
		if e != nil || !dt.After(time.Now()) || dt.After(time.Now().Add(366*24*time.Hour)) || !validChoice(in.EventType, "correr,deporte,juegos,comida,clase,musica,arte,otro") || len(strings.TrimSpace(in.Title)) < 3 || len(in.Title) > 100 || len(strings.TrimSpace(in.Place)) < 3 || len(in.Place) > 160 || in.Capacity < 2 || in.Capacity > 200 || !validChoice(in.Audience, "amigos,amigos+,abierto") {
			return bad("invalid event")
		}
		if in.Audience == "abierto" && (!p.Open.Enabled || !p.Open.Adult) {
			return deny()
		}
		center := in.Center
		if center == nil {
			center = p.Location.Center
		}
		if center == nil || !validPoint(*center) {
			return bad("choose a public event location")
		}
		me, e := h.App.Store.GetUser(t.r.ctx, id)
		if e != nil {
			return fail(e)
		}
		p.Events++
		ev := socialEvent{ID: uuid.NewString(), Owner: id, Type: in.EventType, Title: strings.TrimSpace(in.Title), Starts: dt.UTC().Format(time.RFC3339Nano), Place: strings.TrimSpace(in.Place), Center: approximate(*center), Capacity: in.Capacity, Going: 1, Audience: in.Audience, Approval: in.Approval, Friends: []string{}, XP: 40, Organizer: map[string]any{"name": me.DisplayName, "verified": false, "eventsCount": p.Events}, Members: map[string]attendance{id: {User: id, Status: "going", Joined: nowISO()}}}
		a := ev.Members[id]
		a.Event = ev.ID
		ev.Members[id] = a
		if in.EventType == "correr" {
			ev.Paces = []string{"Tranquilo", "Medio", "Rápido"}
		}
		p.Draft = nil
		if e = t.save("events", ev.ID, ev); e != nil {
			return fail(e)
		}
		reward(p, 60, "Evento organizado", "organize:"+ev.ID)
		return ev, 200, nil
	case "joinEvent", "leaveEvent", "setPace", "approveAttendance", "rejectAttendance":
		var ev socialEvent
		if err := t.load("events", in.ID, &ev); err != nil {
			return fail(err)
		}
		if ev.ID == "" || !active(ev.Starts) {
			return bad("event not found or already started")
		}
		ok, e := t.allowEvent(ev, id)
		if e != nil {
			return fail(e)
		}
		if !ok {
			return deny()
		}
		uid := id
		if in.Type == "approveAttendance" || in.Type == "rejectAttendance" {
			if ev.Owner != id {
				return deny()
			}
			uid = in.UserID
		}
		a, exists := ev.Members[uid]
		if len(in.Pace) > 40 {
			return bad("pace too long")
		}
		switch in.Type {
		case "joinEvent":
			if exists && a.Status != "left" {
				return a, 200, nil
			}
			if len(ev.Members) >= 500 {
				return bad("event request limit reached")
			}
			if ev.Going >= ev.Capacity {
				return bad("event is full")
			}
			status := "going"
			if ev.Approval {
				status = "pending"
			} else {
				ev.Going++
			}
			a = attendance{User: uid, Event: ev.ID, Pace: in.Pace, Joined: nowISO(), Status: status, Rewarded: a.Rewarded}
			if status == "going" && !a.Rewarded {
				reward(p, ev.XP, "Asistencia a evento", "attend:"+ev.ID)
				a.Rewarded = true
			}
			ev.Members[uid] = a
		case "leaveEvent", "rejectAttendance":
			if uid == ev.Owner {
				return bad("organizer cannot leave")
			}
			if exists {
				if a.Status == "going" {
					ev.Going--
				}
				a.Status = "left"
				ev.Members[uid] = a
			}
		case "setPace":
			if !exists || a.Status == "left" {
				return bad("join the event first")
			}
			a.Pace = in.Pace
			ev.Members[uid] = a
		case "approveAttendance":
			if !exists {
				return bad("request not found")
			}
			b, e := t.blocked(id, uid)
			if e != nil {
				return fail(e)
			}
			if b {
				return deny()
			}
			if a.Status == "pending" {
				if ev.Going >= ev.Capacity {
					return bad("event is full")
				}
				a.Status = "going"
				ev.Going++
				if !a.Rewarded {
					q, e := t.person(uid)
					if e != nil {
						return fail(e)
					}
					reward(&q, ev.XP, "Asistencia a evento", "attend:"+ev.ID)
					if e = t.save("user#"+uid, "profile", q); e != nil {
						return fail(e)
					}
					a.Rewarded = true
				}
				ev.Members[uid] = a
			}
		}
		if err := t.save("events", ev.ID, ev); err != nil {
			return fail(err)
		}
	case "jalo":
		host := strings.SplitN(in.ID, ":", 2)[0]
		if host == id {
			return bad("cannot join your own plan")
		}
		ok, e := t.friends(id, host)
		if e != nil {
			return fail(e)
		}
		b, e := t.blocked(id, host)
		if e != nil {
			return fail(e)
		}
		if !ok || b {
			return deny()
		}
		var plan socialPlan
		if e = t.load("user#"+host, "plan", &plan); e != nil {
			return fail(e)
		}
		if plan.ID != in.ID || !active(plan.Expires) {
			return bad("plan expired")
		}
		owner, e := t.person(host)
		if e != nil {
			return fail(e)
		}
		if plan.Audience == "roomies" && !contains(owner.Roomies, id) {
			return deny()
		}
		if plan.Audience == "abierto" && (!p.Open.Enabled || !p.Open.Adult || !p.Open.Small) {
			return deny()
		}
		u, e := h.App.Store.GetUser(t.r.ctx, host)
		if e != nil {
			return fail(e)
		}
		if u == nil || u.GhostMode {
			return deny()
		}
		mid := uuid.NewSHA1(uuid.NameSpaceURL, []byte(in.ID+":"+id)).String()
		var existing socialMatch
		if e = t.load("match#"+mid, "data", &existing); e != nil {
			return fail(e)
		}
		if existing.ID != "" {
			return mid, 200, nil
		}
		until := time.Now().Add(time.Hour)
		exp, _ := time.Parse(time.RFC3339Nano, plan.Expires)
		if exp.Before(until) {
			until = exp
		}
		m := socialMatch{ID: mid, PlanID: plan.ID, Host: host, Guest: id, Created: nowISO(), Until: until.UTC().Format(time.RFC3339Nano), Meet: plan.Meet, Messages: map[string]string{}, Confirmed: map[string]bool{}, Plan: plan}
		if plan.Joined >= 100 {
			return bad("plan participant limit reached")
		}
		plan.Joined++
		if e = t.save("user#"+host, "plan", plan); e != nil {
			return fail(e)
		}
		if e = t.save("match#"+mid, "data", m); e != nil {
			return fail(e)
		}
		for _, uid := range []string{id, host} {
			if e = t.save("user#"+uid, "match#"+mid, map[string]string{"id": mid}); e != nil {
				return fail(e)
			}
		}
		p.Swipes["plan:"+plan.ID] = "join"
		return mid, 200, nil
	case "quickMessage", "confirmMeet":
		var m socialMatch
		if e := t.load("match#"+in.ID, "data", &m); e != nil {
			return fail(e)
		}
		if m.ID == "" || (id != m.Host && id != m.Guest) {
			return deny()
		}
		other := m.Host
		if other == id {
			other = m.Guest
		}
		b, e := t.blocked(id, other)
		if e != nil {
			return fail(e)
		}
		ok, e := t.friends(id, other)
		if e != nil {
			return fail(e)
		}
		if b || !ok {
			return deny()
		}
		if !active(m.Until) {
			return bad("match expired")
		}
		if in.Type == "quickMessage" {
			if !validChoice(in.Message, "Voy en 10,Ya llegué,Se me complicó") {
				return bad("invalid quick message")
			}
			m.Messages[id] = in.Message
		} else {
			locs, e := h.App.Loc.GetMany(t.r.ctx, []string{id, other})
			if e != nil {
				return fail(e)
			}
			a, aok := locs[id]
			b, bok := locs[other]
			if !aok || !bok || location.DistanceM(a, b) > 100 {
				return bad("both people must share a current location within 100 m")
			}
			m.Confirmed[id] = true
			if m.Confirmed[m.Host] && m.Confirmed[m.Guest] && !m.Rewarded {
				m.Rewarded = true
				q, e := t.person(other)
				if e != nil {
					return fail(e)
				}
				for _, v := range []*personal{p, &q} {
					reward(v, 20, "Ya nos vimos", "match:"+m.ID)
					v.Hangouts++
					if v.LastWeek != weekKey() {
						v.Streak = nextStreak(v.LastWeek, v.Streak)
						v.LastWeek = weekKey()
					}
				}
				if e = t.save("user#"+other, "profile", q); e != nil {
					return fail(e)
				}
			}
		}
		if e = t.save("match#"+in.ID, "data", m); e != nil {
			return fail(e)
		}
	case "block", "report", "wave":
		if in.UserID == id || in.UserID == "" {
			return bad("invalid user")
		}
		target, e := h.App.Store.GetUser(t.r.ctx, in.UserID)
		if e != nil {
			return fail(e)
		}
		if target == nil {
			return bad("user not found")
		}
		switch in.Type {
		case "block":
			if !contains(p.Blocks, in.UserID) {
				p.Blocks = append(p.Blocks, in.UserID)
			}
			if len(p.Blocks) > 500 {
				return bad("block limit reached")
			}
		case "report":
			if !validChoice(in.Reason, "Spam o cuenta falsa,Acoso o mensajes ofensivos,Contenido inapropiado,Otro motivo") {
				return bad("invalid report reason")
			}
			if e = t.save("reports", id+"#"+in.UserID, map[string]string{"reporter": id, "userId": in.UserID, "reason": in.Reason, "at": nowISO()}); e != nil {
				return fail(e)
			}
		case "wave":
			b, e := t.blocked(id, in.UserID)
			if e != nil {
				return fail(e)
			}
			if b {
				return deny()
			}
			if !contains(p.Waved, in.UserID) {
				p.Waved = append(p.Waved, in.UserID)
			}
		}
	default:
		return bad("unknown action")
	}
	return nil, 200, nil
}
func nextStreak(last string, n int) int {
	dt := time.Now().UTC().AddDate(0, 0, -7)
	y, w := dt.ISOWeek()
	if last == fmt.Sprintf("%04d-%02d", y, w) {
		return n + 1
	}
	return 1
}

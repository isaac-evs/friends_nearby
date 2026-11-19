package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

const plansPK = "plans.v2"
const eventsPK = "events.v2"

type point struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}
type openMode struct {
	Enabled bool `json:"enabled"`
	Adult   bool `json:"adult"`
	Big     bool `json:"bigEvents"`
	Small   bool `json:"smallPlans"`
}
type chosenLocation struct {
	Status string `json:"status"`
	Center *point `json:"center,omitempty"`
}
type xpEvent struct {
	ID     string `json:"id"`
	Amount int    `json:"amount"`
	Reason string `json:"reason"`
	At     string `json:"at"`
}
type historyItem struct {
	ID        string   `json:"id"`
	Kind      string   `json:"kind"`
	Title     string   `json:"title"`
	Category  string   `json:"categoryLabel"`
	Place     string   `json:"placeName"`
	At        string   `json:"at"`
	Attendees []string `json:"attendeeIds"`
}
type personal struct {
	Model         int               `json:"model"`
	Location      chosenLocation    `json:"location"`
	Open          openMode          `json:"openMode"`
	XP            int               `json:"xp"`
	Level         int               `json:"level"`
	Hangouts      int               `json:"hangouts"`
	Events        int               `json:"eventsCount"`
	Rewards       []xpEvent         `json:"xpEvents"`
	History       []historyItem     `json:"history"`
	Swipes        map[string]string `json:"swipes"`
	Blocks        []string          `json:"blocks"`
	Draft         json.RawMessage   `json:"eventDraft"`
	Close         map[string]string `json:"close"`
	Exact         map[string]string `json:"exactShares"`
	ExactRequests map[string]string `json:"exactRequests"`
	ExactEpoch    int               `json:"exactEpoch"`
	GrantEpoch    map[string]int    `json:"grantEpoch"`
	Radius        int               `json:"radiusM"`
	Visibility    int               `json:"visibilityRadiusM"`
	Availability  string            `json:"availability,omitempty"`
	Bio           string            `json:"bio,omitempty"`
	Avatar        string            `json:"avatarKey,omitempty"`
	Cover         string            `json:"coverKey,omitempty"`
	Commitments   map[string]bool   `json:"commitments"`
}
type publicPlace struct {
	Name    string `json:"name"`
	Address string `json:"address,omitempty"`
	Center  point  `json:"center"`
}
type member struct {
	Status   string `json:"status"`
	Pace     string `json:"pace,omitempty"`
	Joined   string `json:"joinedAt"`
	Verified string `json:"verifiedAt"`
	Rewarded bool   `json:"rewarded"`
}
type socialPlan struct {
	ID        string            `json:"id"`
	Author    string            `json:"authorId"`
	Category  string            `json:"category"`
	Line      string            `json:"line"`
	Starts    string            `json:"startsAt"`
	Duration  int               `json:"durationMin"`
	Expires   string            `json:"expiresAt"`
	Policy    string            `json:"joinPolicy"`
	Joined    int               `json:"joinedCount"`
	Capacity  int               `json:"capacity,omitempty"`
	MemberIDs []string          `json:"memberIds"`
	Place     publicPlace       `json:"place"`
	Photo     string            `json:"photoUrl,omitempty"`
	PhotoKey  string            `json:"photoKey,omitempty"`
	Late      bool              `json:"lateJoin"`
	Members   map[string]member `json:"members,omitempty"`
	Canceled  bool              `json:"canceled"`
}
type socialEvent struct {
	ID        string            `json:"id"`
	Owner     string            `json:"organizerId"`
	Type      string            `json:"type"`
	Subtype   string            `json:"subtype"`
	Title     string            `json:"title"`
	Starts    string            `json:"startsAt"`
	Ends      string            `json:"endsAt"`
	Place     string            `json:"placeName"`
	Center    point             `json:"center"`
	Capacity  int               `json:"capacity"`
	Going     int               `json:"going"`
	Organizer map[string]any    `json:"organizer"`
	Alias     string            `json:"alias,omitempty"`
	Photo     string            `json:"photoUrl,omitempty"`
	PhotoKey  string            `json:"photoKey,omitempty"`
	Late      bool              `json:"lateJoin"`
	Approval  bool              `json:"requiresApproval"`
	Friends   []string          `json:"friendsGoingIds"`
	XP        int               `json:"xp"`
	Paces     []string          `json:"paces,omitempty"`
	Members   map[string]member `json:"members,omitempty"`
	Canceled  bool              `json:"canceled"`
}
type socialMatch struct {
	ID        string            `json:"id"`
	PlanID    string            `json:"planId"`
	Host      string            `json:"hostId"`
	Guest     string            `json:"guestId"`
	Created   string            `json:"createdAt"`
	Messages  map[string]string `json:"messages"`
	Confirmed map[string]bool   `json:"confirmed"`
	Rewarded  bool              `json:"rewarded"`
}
type invitation struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Target string `json:"targetId"`
	Title  string `json:"title"`
	From   string `json:"fromId"`
	To     string `json:"toId"`
	Status string `json:"status"`
	At     string `json:"at"`
}
type socialAction struct {
	Type         string          `json:"type"`
	ID           string          `json:"id"`
	UserID       string          `json:"userId"`
	Kind         string          `json:"kind"`
	Action       string          `json:"action"`
	Message      string          `json:"message"`
	Reason       string          `json:"reason"`
	Category     string          `json:"category"`
	Line         string          `json:"line"`
	Starts       string          `json:"startsAt"`
	Ends         string          `json:"endsAt"`
	Duration     int             `json:"durationMin"`
	Policy       string          `json:"joinPolicy"`
	Capacity     int             `json:"capacity"`
	Late         bool            `json:"lateJoin"`
	Place        *publicPlace    `json:"place"`
	PhotoKey     string          `json:"photoKey"`
	InviteIDs    []string        `json:"inviteIds"`
	EventType    string          `json:"eventType"`
	Title        string          `json:"title"`
	PlaceName    string          `json:"placeName"`
	Center       *point          `json:"center"`
	Alias        string          `json:"alias"`
	Approval     bool            `json:"requiresApproval"`
	Pace         string          `json:"pace"`
	Location     *chosenLocation `json:"location"`
	Open         *openMode       `json:"openMode"`
	Draft        json.RawMessage `json:"draft"`
	Radius       int             `json:"radiusM"`
	Minutes      int             `json:"minutes"`
	Accept       bool            `json:"accept"`
	Availability string          `json:"availability"`
	Name         string          `json:"name"`
	Username     string          `json:"username"`
	Bio          string          `json:"bio"`
	MediaKind    string          `json:"mediaKind"`
	Key          string          `json:"key"`
	RequestID    string          `json:"requestId"`
	Enabled      *bool           `json:"enabled"`
}
type socialTx struct {
	h        *Handler
	r        *request
	docs     map[string]store.Document
	dirty    map[string]bool
	accounts []store.AccountChange
}

func newSocialTx(h *Handler, r *request) *socialTx {
	return &socialTx{h: h, r: r, docs: map[string]store.Document{}, dirty: map[string]bool{}}
}
func (t *socialTx) load(pk, sk string, v any) error {
	key := pk + "/" + sk
	d, ok := t.docs[key]
	if !ok {
		var e error
		d, e = t.h.App.Store.GetDocument(t.r.ctx, pk, sk)
		if e != nil {
			return e
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
	if _, ok := t.docs[key]; !ok {
		if e := t.load(pk, sk, &json.RawMessage{}); e != nil {
			return e
		}
	}
	d := t.docs[key]
	b, e := json.Marshal(v)
	if e != nil {
		return e
	}
	d.Data = b
	if strings.HasPrefix(pk, "requests#") {
		d.ExpiresAt = time.Now().Add(24 * time.Hour).Unix()
	}
	t.docs[key] = d
	t.dirty[key] = true
	return nil
}
func (t *socialTx) person(id string) (personal, error) {
	p := personal{Model: 2, Location: chosenLocation{Status: "unknown"}, Open: openMode{Big: true}, Level: 1, Radius: 5000, Visibility: 3000, Swipes: map[string]string{}, Close: map[string]string{}, Exact: map[string]string{}, ExactRequests: map[string]string{}, GrantEpoch: map[string]int{}, Commitments: map[string]bool{}, Blocks: []string{}, Rewards: []xpEvent{}, History: []historyItem{}}
	e := t.load("user#"+id, "profile", &p)
	if p.Level < 1 {
		p.Level = 1
	}
	return p, e
}
func (t *socialTx) putPerson(id string, p personal) error { return t.save("user#"+id, "profile", p) }
func (t *socialTx) commit() error {
	docs := []store.Document{}
	checks := []store.Document{}
	for k, d := range t.docs {
		if t.dirty[k] {
			docs = append(docs, d)
		} else {
			checks = append(checks, d)
		}
	}
	return t.h.App.Store.CommitDocumentsAndAccounts(t.r.ctx, docs, checks, t.accounts)
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
func (t *socialTx) close(a, b string) (bool, error) {
	ok, e := t.friends(a, b)
	if e != nil || !ok {
		return false, e
	}
	blocked, e := t.blocked(a, b)
	if e != nil || blocked {
		return false, e
	}
	p, e := t.person(a)
	if e != nil {
		return false, e
	}
	q, e := t.person(b)
	return p.Close[b] == "mutual" && q.Close[a] == "mutual", e
}
func contains(a []string, s string) bool {
	for _, v := range a {
		if v == s {
			return true
		}
	}
	return false
}
func validChoice(v, list string) bool { return contains(strings.Split(list, ","), v) }
func validPoint(p point) bool {
	return !math.IsNaN(p.Lat) && !math.IsNaN(p.Lng) && p.Lat >= -90 && p.Lat <= 90 && p.Lng >= -180 && p.Lng <= 180
}
func approximate(p point) point {
	return point{math.Round(p.Lat/0.002) * 0.002, math.Round(p.Lng/0.002) * 0.002}
}
func nowISO() string             { return time.Now().UTC().Format(time.RFC3339Nano) }
func instant(s string) time.Time { dt, _ := time.Parse(time.RFC3339Nano, s); return dt }
func active(s string) bool       { return instant(s).After(time.Now()) }
func reward(p *personal, amount int, reason, id string) {
	for _, v := range p.Rewards {
		if v.ID == id {
			return
		}
	}
	p.XP += amount
	for p.XP >= 500 && p.Level < 100 {
		p.XP -= 500
		p.Level++
	}
	if p.Level == 100 && p.XP > 500 {
		p.XP = 500
	}
	p.Rewards = append(p.Rewards, xpEvent{id, amount, reason, nowISO()})
	if len(p.Rewards) > 500 {
		p.Rewards = p.Rewards[len(p.Rewards)-500:]
	}
}
func streak(history []historyItem) int {
	seen := map[string]bool{}
	for _, v := range history {
		dt := instant(v.At)
		if dt.After(time.Now()) {
			continue
		}
		y, w := dt.ISOWeek()
		seen[fmt.Sprintf("%d-%d", y, w)] = true
	}
	now := time.Now().UTC()
	n := 0
	for i := 0; i < 5200; i++ {
		dt := now.AddDate(0, 0, -7*i)
		y, w := dt.ISOWeek()
		if !seen[fmt.Sprintf("%d-%d", y, w)] {
			if i == 0 {
				continue
			}
			break
		}
		n++
	}
	return n
}
func historyOnce(p *personal, item historyItem) {
	for _, h := range p.History {
		if h.ID == item.ID {
			return
		}
	}
	p.History = append(p.History, item)
}

type domainError struct {
	code    int
	message string
}

func (e *domainError) Error() string { return e.message }
func invalid(s string) error         { return &domainError{400, s} }
func denied() error                  { return &domainError{403, "No tienes permiso para esta operación."} }
func conflict(s string) error        { return &domainError{409, s} }
func responseError(e error) httpResp {
	var de *domainError
	if errors.As(e, &de) {
		return respond(de.code, errBody(de.message))
	}
	if errors.Is(e, store.ErrConflict) {
		return respond(409, errBody("Los datos cambiaron. Actualiza e inténtalo de nuevo."))
	}
	if errors.Is(e, store.ErrUsernameTaken) {
		return respond(409, errBody("Ese nombre de usuario ya está en uso."))
	}
	return internalError("social action", e)
}

package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

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
	Bio           string            `json:"bio,omitempty"`
	Avatar        string            `json:"avatarKey,omitempty"`
	Cover         string            `json:"coverKey,omitempty"`
	Commitments   map[string]bool   `json:"commitments"`
	// G6: últimos 20 compromisos ("ok" cumplido, "miss" faltó o canceló tarde). Confiabilidad = ok de los últimos 20.
	Record []string `json:"record,omitempty"`
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
	// G6: quién confirmó su llegada (si el GPS falló), última vez que mandó un mensaje rápido y si ya se le evaluó la asistencia.
	ConfirmedBy string `json:"confirmedBy,omitempty"`
	LastMsgAt   string `json:"lastMsgAt,omitempty"`
	Settled     bool   `json:"settled,omitempty"`
	LeftAt      string `json:"leftAt,omitempty"`
}
type planMsg struct {
	ID   string `json:"id,omitempty"`
	User string `json:"userId"`
	Text string `json:"text"`
	At   string `json:"at"`
}
type rosterEntry struct {
	UserID      string `json:"userId"`
	Organizer   bool   `json:"organizer"`
	ArrivedAt   string `json:"arrivedAt,omitempty"`
	ConfirmedBy string `json:"confirmedBy,omitempty"`
	// A cuánto está del lugar (redondeado a 100 m, sin coordenadas). Solo para integrantes y desde 10 min antes; nunca de quien llegó.
	DistanceM *int `json:"distanceM,omitempty"`
	// Cuándo se unió: quien entra con el plan en curso no llega "tarde" (ver `joinedInProgress`).
	JoinedAt string `json:"joinedAt,omitempty"`
	LocAt    string `json:"locAt,omitempty"`
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
	// Historial de cancelados: cuándo se canceló el plan.
	CanceledAt string `json:"canceledAt,omitempty"`
	// G6: último cambio de hora o lugar, mensajes rápidos y quiénes van (solo para integrantes).
	Changed string `json:"changedAt,omitempty"`
	// Quien organiza elige cómo se ve el chat del plan (uno de `chatThemes`).
	ChatTheme string        `json:"chatTheme,omitempty"`
	Timeline  []planMsg     `json:"timeline,omitempty"`
	Roster    []rosterEntry `json:"roster,omitempty"`
}
type socialEvent struct {
	ID        string            `json:"id"`
	Owner     string            `json:"organizerId"`
	Type      string            `json:"type"`
	Subtype   string            `json:"subtype"`
	TypeIcon  string            `json:"typeIcon,omitempty"`
	TypeColor string            `json:"typeColor,omitempty"`
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
	Verify    string            `json:"verification"`
	Friends   []string          `json:"friendsGoingIds"`
	XP        int               `json:"xp"`
	Paces     []string          `json:"paces,omitempty"`
	Members   map[string]member `json:"members,omitempty"`
	Canceled  bool              `json:"canceled"`
	// Lo que quien organiza controla: descripción, avisos, y si hay chat (con sus mensajes, solo para quienes van).
	Description   string         `json:"description,omitempty"`
	Announcements []announcement `json:"announcements,omitempty"`
	ChatEnabled   bool           `json:"chatEnabled"`
	Timeline      []planMsg      `json:"timeline,omitempty"`
}
type announcement struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	At   string `json:"at"`
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
	Type        string          `json:"type"`
	ID          string          `json:"id"`
	UserID      string          `json:"userId"`
	Kind        string          `json:"kind"`
	Action      string          `json:"action"`
	Message     string          `json:"message"`
	Reason      string          `json:"reason"`
	Category    string          `json:"category"`
	Line        string          `json:"line"`
	Starts      string          `json:"startsAt"`
	Ends        string          `json:"endsAt"`
	Duration    int             `json:"durationMin"`
	Policy      string          `json:"joinPolicy"`
	Capacity    int             `json:"capacity"`
	Late        bool            `json:"lateJoin"`
	Place       *publicPlace    `json:"place"`
	PhotoKey    string          `json:"photoKey"`
	InviteIDs   []string        `json:"inviteIds"`
	EventType   string          `json:"eventType"`
	Title       string          `json:"title"`
	PlaceName   string          `json:"placeName"`
	Center      *point          `json:"center"`
	Alias       string          `json:"alias"`
	Approval    bool            `json:"requiresApproval"`
	Verify      string          `json:"verification"`
	Pace        string          `json:"pace"`
	Description string          `json:"description"`
	ChatEnabled *bool           `json:"chatEnabled"`
	Location    *chosenLocation `json:"location"`
	Open        *openMode       `json:"openMode"`
	Draft       json.RawMessage `json:"draft"`
	Radius      int             `json:"radiusM"`
	Minutes     int             `json:"minutes"`
	Accept      bool            `json:"accept"`
	Name        string          `json:"name"`
	Username    string          `json:"username"`
	Bio         string          `json:"bio"`
	MediaKind   string          `json:"mediaKind"`
	Key         string          `json:"key"`
	RequestID   string          `json:"requestId"`
	Accuracy    float64         `json:"accuracy"`
	Enabled     *bool           `json:"enabled"`
	Subtype     string          `json:"subtype"`
	TypeIcon    string          `json:"typeIcon"`
	TypeColor   string          `json:"typeColor"`
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
	if p.Level < minLevel || p.Level > 100 {
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

// cleanChat: texto libre del chat del plan. Quita espacios y caracteres de control; 1–280 caracteres.
func cleanChat(v string) (string, bool) {
	v = strings.Join(strings.Fields(strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' {
			return ' '
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, v)), " ")
	n := utf8.RuneCountInString(v)
	return v, n >= 1 && n <= maxChatRunes
}
func validChoice(v, list string) bool { return contains(strings.Split(list, ","), v) }
func validPoint(p point) bool {
	return !math.IsNaN(p.Lat) && !math.IsNaN(p.Lng) && p.Lat >= -90 && p.Lat <= 90 && p.Lng >= -180 && p.Lng <= 180
}
func approximate(p point) point {
	return point{math.Round(p.Lat/0.002) * 0.002, math.Round(p.Lng/0.002) * 0.002}
}

// mxZone: las semanas de la racha se cuentan en hora de Ciudad de México (UTC−6 fijo desde 2022); todos los instantes se guardan en UTC.
var mxZone = time.FixedZone("America/Mexico_City", -6*3600)

func nowISO() string             { return time.Now().UTC().Format(time.RFC3339Nano) }
func instant(s string) time.Time { dt, _ := time.Parse(time.RFC3339Nano, s); return dt }
func active(s string) bool       { return instant(s).After(time.Now()) }
func reward(p *personal, amount int, reason, id string) {
	for _, v := range p.Rewards {
		if v.ID == id {
			return
		}
	}
	if p.Level <= 0 {
		if amount < recoverXP {
			return
		}
		// Con ganar 10 XP vuelves al nivel 1; lo que sobre cuenta.
		p.Level, p.XP = 1, 0
		amount -= recoverXP
	}
	p.XP += amount
	for p.XP >= xpPerLevel && p.Level < 100 {
		p.XP -= xpPerLevel
		p.Level++
	}
	if p.Level == 100 && p.XP > xpPerLevel {
		p.XP = xpPerLevel
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
		y, w := dt.In(mxZone).ISOWeek()
		seen[fmt.Sprintf("%d-%d", y, w)] = true
	}
	now := time.Now().UTC()
	n := 0
	for i := 0; i < 5200; i++ {
		dt := now.AddDate(0, 0, -7*i)
		y, w := dt.In(mxZone).ISOWeek()
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

// ---------------------------------------------------------------- G6: reglas de confiabilidad

const (
	checkInMeters     = 250 // radio exacto para confirmar la llegada (sin margen extra)
	checkInLeadMin    = 10  // el check-in y el lobby abren 10 min antes
	graceAfterEdit    = 2 * time.Hour
	noShowPenalty     = 80
	finishXP          = 30 // quien organiza gana XP al terminar su plan
	arrivedBonusXP    = 5  // + por cada persona que llegó a tu plan
	maxArrivedBonus   = 25
	lateCancelXP      = 60
	startedCancelXP   = 100
	minLevel          = -9 // easter egg: por debajo del nivel 1 hay nivel 0 y niveles negativos; con 10 XP vuelves al 1
	recoverXP         = 10
	joinOrganizerXP   = 5 // quien organiza un evento gana por cada persona que se une
	arriveOrganizerXP = 5 // y otro tanto si esa persona llega
	maxSubtypeRunes   = 20
	xpPerLevel        = 150 // XP para subir de nivel (antes 500): ~4-6 jales por nivel
	recordSize        = 20
	messageCooldown   = time.Second // chat del plan: libre, pero sin ráfagas
	maxChatRunes      = 280
	maxTimeline       = 100
	staleLocation     = 15 * time.Minute // una ubicación más vieja que esto no cuenta como "a cuánto está"
)

var chatThemes = "indigo,naranja,verde,oscuro,rojo"

// historyDays: cuánto tiempo siguen consultables (con su chat) los planes que ya terminaron.
const historyDays = 30

const (
	maxDescription   = 1000
	maxAnnouncements = 20
	maxAnnounceRunes = 500
)

var quickMessages = "Ya voy,Llego en 5,Llego en 10,Voy tarde,Ya estoy aquí,¿Dónde están?"

// cancelPenalty: XP que se pierde por cancelar con `minutes` minutos antes del inicio (negativo = ya empezó) y si cuenta como falla.
func cancelPenalty(minutes int) (xp int, miss bool) {
	switch {
	case minutes > 90:
		return 10, false
	case minutes >= 15:
		return 25 + (90-minutes)*25/75, false
	case minutes < 0:
		return startedCancelXP, true // ya empezó y no llegaste: cuesta más
	default:
		return lateCancelXP, true
	}
}

func addRecord(p *personal, v string) {
	p.Record = append(p.Record, v)
	if len(p.Record) > recordSize {
		p.Record = p.Record[len(p.Record)-recordSize:]
	}
}

// penalize resta XP (nunca baja de 0 ni de nivel) una sola vez por `id`.
func penalize(p *personal, amount int, reason, id string, miss bool) {
	for _, v := range p.Rewards {
		if v.ID == id {
			return
		}
	}
	if debt := amount - p.XP; debt > 0 {
		p.XP = 0
		// Easter egg: sin XP que perder, el nivel 1 baja al 0 y cada falla más, a niveles negativos. Los niveles 2+ no bajan.
		if p.Level <= 1 {
			p.Level = max(minLevel, p.Level-1)
		}
	} else {
		p.XP -= amount
	}
	p.Rewards = append(p.Rewards, xpEvent{id, -amount, reason, nowISO()})
	if len(p.Rewards) > 500 {
		p.Rewards = p.Rewards[len(p.Rewards)-500:]
	}
	if miss {
		addRecord(p, "miss")
	}
}

// friendDistance redondea a múltiplos de 100 m (mínimo 100): la distancia de un amigo es aproximada, nunca una coordenada.
func friendDistance(m int) int { return max(100, (m+50)/100*100) }

// recordOrEmpty evita serializar una lista vacía como `null`.
func recordOrEmpty(r []string) []string {
	if r == nil {
		return []string{}
	}
	return r
}

// arrivalXP: cuánto vale llegar según la puntualidad. El check-in abre 10 min antes: temprano paga más; tarde, menos.
func arrivalXP(starts, at time.Time) (int, string) {
	d := at.Sub(starts)
	switch {
	case d <= -5*time.Minute:
		return 30, "temprano"
	case d <= 5*time.Minute:
		return 20, "a tiempo"
	case d <= 15*time.Minute:
		return 12, "tarde"
	case d <= 30*time.Minute:
		return 8, "tarde"
	default:
		return 5, "muy tarde"
	}
}

// joinInProgressGrace: unirse hasta 2 min después del inicio sigue siendo "a tiempo" (el plan creado con "ahora" empieza ya).
const joinInProgressGrace = 2 * time.Minute

// joinedInProgress: te uniste con el plan ya iniciado. Quien entra así no está obligado a nada: no llega tarde, no cuenta
// como no-show y salirse no penaliza (ya lo viste empezado).
func joinedInProgress(plan socialPlan, m member) bool {
	return m.Joined != "" && instant(m.Joined).After(instant(plan.Starts).Add(joinInProgressGrace))
}

// dueAt: a qué hora se espera que llegue alguien: el inicio del plan o, si se unió después, cuando se unió.
func dueAt(plan socialPlan, m member) time.Time {
	if j := instant(m.Joined); m.Joined != "" && j.After(instant(plan.Starts)) {
		return j
	}
	return instant(plan.Starts)
}

// cleanText: texto libre de una o varias líneas (descripciones y avisos): sin caracteres de control, sin espacios de más, con tope.
func cleanText(v string, max int) string {
	v = strings.TrimSpace(strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' {
			return r
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, v))
	if utf8.RuneCountInString(v) > max {
		v = string([]rune(v)[:max])
	}
	return v
}

// eventIcons: íconos que se pueden elegir para un evento de tipo "otro" (solo ese evento).
const eventIcons = "star,heart,camera,gamepad,bike,mountain,coffee,pizza,palette,mic,dumbbell,tent,film,book,paw,sparkles"

// eventColors: colores (tokens de categoría) para un evento de tipo "otro".
const eventColors = "cafe,correr,deporte,estudiar,comer,musica,clase,otro"

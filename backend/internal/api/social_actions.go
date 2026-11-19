package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

type receipt struct {
	Hash   string          `json:"hash"`
	Result json.RawMessage `json:"result"`
}

func (h *Handler) socialAction(r *request) httpResp {
	var in socialAction
	if e := r.decode(&in); e != nil {
		return respond(400, errBody(e.Error()))
	}
	if _, e := uuid.Parse(in.RequestID); e != nil {
		return respond(400, errBody("requestId debe ser un UUID."))
	}
	id := in.RequestID
	in.RequestID = ""
	copyForHash := in
	if in.Type == "verifyTogether" {
		copyForHash.Center = nil
	}
	canonical, _ := json.Marshal(copyForHash)
	sum := sha256.Sum256(canonical)
	hash := hex.EncodeToString(sum[:])
	t := newSocialTx(h, r)
	var old receipt
	if e := t.load("requests#"+r.userID, id, &old); e != nil {
		return responseError(e)
	}
	if old.Hash != "" {
		if old.Hash != hash {
			return respond(409, errBody("requestId ya se usó para otra operación."))
		}
		return respond(200, map[string]any{"result": old.Result})
	}
	p, e := t.person(r.userID)
	if e != nil {
		return responseError(e)
	}
	result, e := h.applySocial(t, &p, in)
	if e != nil {
		return responseError(e)
	}
	if e = t.putPerson(r.userID, p); e != nil {
		return responseError(e)
	}
	// Ranking contains public projections only; the private profile is never queried by strangers.
	me, e := t.user(r.userID)
	if e != nil {
		return responseError(e)
	}
	view, e := t.userView(me)
	if e != nil {
		return responseError(e)
	}
	if e = t.save("ranking.v2", r.userID, view); e != nil {
		return responseError(e)
	}
	changedUsers := []string{}
	for key := range t.dirty {
		if strings.HasPrefix(key, "user#") && strings.HasSuffix(key, "/profile") {
			uid := strings.TrimSuffix(strings.TrimPrefix(key, "user#"), "/profile")
			if uid != r.userID {
				changedUsers = append(changedUsers, uid)
			}
		}
	}
	for _, uid := range changedUsers {
		u, err := t.user(uid)
		if err != nil {
			return responseError(err)
		}
		v, err := t.userView(u)
		if err != nil {
			return responseError(err)
		}
		if err = t.save("ranking.v2", uid, v); err != nil {
			return responseError(err)
		}
	}
	data, e := json.Marshal(result)
	if e != nil {
		return responseError(e)
	}
	if e = t.save("requests#"+r.userID, id, receipt{hash, data}); e != nil {
		return responseError(e)
	}
	if e = t.commit(); e != nil {
		return responseError(e)
	}
	targets := map[string]bool{r.userID: true}
	for key := range t.dirty {
		if strings.HasPrefix(key, "user#") {
			parts := strings.SplitN(strings.TrimPrefix(key, "user#"), "/", 2)
			targets[parts[0]] = true
		}
	}
	friends, e := h.App.Store.AcceptedFriendIDs(r.ctx, r.userID)
	if e == nil {
		for _, fid := range friends {
			targets[fid] = true
		}
	}
	// Notifications are invalidations, never personal coordinates or venue data.
	for uid := range targets {
		h.App.NotifyChange(r.ctx, uid)
	}
	if in.Type == "setLocation" && in.Location != nil && in.Location.Status != "granted" {
		_ = h.App.Loc.Delete(r.ctx, r.userID)
	}
	if in.Type == "stopExact" || in.Type == "removeClose" || in.Type == "block" {
		_ = h.App.Loc.DeleteExact(r.ctx, r.userID)
	}
	return respond(200, map[string]any{"result": result})
}
func validMediaKey(id, key string) bool { return key == "" || strings.HasPrefix(key, "photos/"+id+"/") }
func (t *socialTx) user(id string) (*models.User, error) {
	for _, change := range t.accounts {
		if change.After.UserID == id {
			return change.After, nil
		}
	}
	u, e := t.h.App.Store.GetUser(t.r.ctx, id)
	if e != nil {
		return nil, e
	}
	if u == nil {
		return nil, invalid("Usuario no encontrado.")
	}
	return u, nil
}
func (t *socialTx) changeAccount(id string, apply func(*models.User)) error {
	u, e := t.user(id)
	if e != nil {
		return e
	}
	copy := *u
	apply(&copy)
	t.accounts = append(t.accounts, store.AccountChange{Before: u, After: &copy})
	return nil
}
func (t *socialTx) checkSchedule(id, start, end, ignore string) error {
	p, e := t.person(id)
	if e != nil {
		return e
	}
	a, b := instant(start), instant(end)
	for ref := range p.Commitments {
		if ref == ignore {
			continue
		}
		parts := strings.SplitN(ref, ":", 2)
		if len(parts) != 2 {
			continue
		}
		var s, f string
		if parts[0] == "plan" {
			var plan socialPlan
			if e = t.load(plansPK, parts[1], &plan); e != nil {
				return e
			}
			if plan.Canceled || !active(plan.Expires) || plan.Members[id].Status != "going" {
				continue
			}
			s, f = plan.Starts, plan.Expires
		} else {
			var ev socialEvent
			if e = t.load(eventsPK, parts[1], &ev); e != nil {
				return e
			}
			if ev.Canceled || !active(ev.Ends) || ev.Members[id].Status != "going" {
				continue
			}
			s, f = ev.Starts, ev.Ends
		}
		if a.Before(instant(f)) && instant(s).Before(b) {
			return conflict("Ya tienes un plan o evento a esa hora.")
		}
	}
	return nil
}
func validTimes(start, end string) bool {
	a, b := instant(start), instant(end)
	return !a.IsZero() && !b.IsZero() && b.After(a) && b.Sub(a) <= 24*time.Hour && b.After(time.Now()) && a.Before(time.Now().AddDate(1, 0, 0))
}
func (t *socialTx) requireJoin(id, start, end string, late bool) error {
	if !active(end) {
		return invalid("Ya terminó.")
	}
	if instant(start).Before(time.Now()) && !late {
		return invalid("Ya empezó y no admite más gente.")
	}
	return nil
}
func (t *socialTx) clearPair(p *personal, other string) error {
	q, e := t.person(other)
	if e != nil {
		return e
	}
	for _, pair := range []struct {
		p  *personal
		id string
	}{{p, other}, {&q, t.r.userID}} {
		delete(pair.p.Close, pair.id)
		delete(pair.p.Exact, pair.id)
		delete(pair.p.ExactRequests, pair.id)
	}
	return t.putPerson(other, q)
}
func (t *socialTx) invite(kind, target, title string, ids []string) (int, error) {
	if len(ids) > 20 {
		return 0, invalid("Puedes invitar a un máximo de 20 personas por operación.")
	}
	sent := 0
	seen := map[string]bool{}
	for _, to := range ids {
		if to == t.r.userID || seen[to] {
			continue
		}
		seen[to] = true
		ok, e := t.friends(t.r.userID, to)
		if e != nil {
			return 0, e
		}
		b, e := t.blocked(t.r.userID, to)
		if e != nil {
			return 0, e
		}
		if !ok || b {
			return 0, denied()
		}
		if _, e = t.user(to); e != nil {
			return 0, e
		}
		id := uuid.NewSHA1(uuid.NameSpaceURL, []byte(kind+":"+target+":"+to)).String()
		var old invitation
		if e = t.load("invites.v2", id, &old); e != nil {
			return 0, e
		}
		if old.ID != "" {
			continue
		}
		inv := invitation{id, kind, target, title, t.r.userID, to, "pending", nowISO()}
		if e = t.save("invites.v2", id, inv); e != nil {
			return 0, e
		}
		for _, uid := range []string{t.r.userID, to} {
			if e = t.save("user#"+uid, "invite#"+id, inv); e != nil {
				return 0, e
			}
		}
		sent++
	}
	return sent, nil
}
func (t *socialTx) joinPlan(p *personal, plan *socialPlan, invited bool) (string, error) {
	id := t.r.userID
	if id == plan.Author {
		return "", invalid("Tú organizas este plan.")
	}
	if plan.Canceled {
		return "", invalid("Plan cancelado.")
	}
	if e := t.requireJoin(id, plan.Starts, plan.Expires, plan.Late); e != nil {
		return "", e
	}
	b, e := t.blocked(id, plan.Author)
	if e != nil {
		return "", e
	}
	if b {
		return "", denied()
	}
	friend, e := t.friends(id, plan.Author)
	if e != nil {
		return "", e
	}
	if !friend && (!invited || plan.Policy != "friends_and_guests") {
		return "", denied()
	}
	mid := uuid.NewSHA1(uuid.NameSpaceURL, []byte(plan.ID+":"+id)).String()
	var m socialMatch
	if e = t.load("matches.v2", mid, &m); e != nil {
		return "", e
	}
	if m.ID != "" && plan.Members[id].Status == "going" {
		return mid, nil
	}
	if plan.Joined >= 99 || (plan.Capacity > 0 && plan.Joined+1 >= plan.Capacity) {
		return "", invalid("Ya está lleno.")
	}
	if e = t.checkSchedule(id, plan.Starts, plan.Expires, "plan:"+plan.ID); e != nil {
		return "", e
	}
	if plan.Members == nil {
		plan.Members = map[string]member{}
	}
	plan.Members[id] = member{Status: "going", Joined: nowISO()}
	plan.Joined = 0
	plan.MemberIDs = []string{}
	for uid, mem := range plan.Members {
		if uid != plan.Author && mem.Status == "going" {
			plan.Joined++
			plan.MemberIDs = append(plan.MemberIDs, uid)
		}
	}
	m = socialMatch{ID: mid, PlanID: plan.ID, Host: plan.Author, Guest: id, Created: nowISO(), Messages: map[string]string{}, Confirmed: map[string]bool{}}
	if e = t.save("matches.v2", mid, m); e != nil {
		return "", e
	}
	for _, uid := range []string{id, plan.Author} {
		if e = t.save("user#"+uid, "match#"+mid, map[string]string{"id": mid}); e != nil {
			return "", e
		}
	}
	if e = t.save(plansPK, plan.ID, plan); e != nil {
		return "", e
	}
	p.Commitments["plan:"+plan.ID] = true
	p.Swipes["plan:"+plan.ID] = "join"
	return mid, nil
}

// joinEvent: todos los eventos piden el modo abierto (adulto), también si te invitaron; el cliente te lleva a activarlo primero.
func (t *socialTx) joinEvent(p *personal, ev *socialEvent) error {
	id := t.r.userID
	if ev.Canceled {
		return invalid("Evento cancelado.")
	}
	if e := t.requireJoin(id, ev.Starts, ev.Ends, ev.Late); e != nil {
		return e
	}
	if !p.Open.Enabled || !p.Open.Adult {
		return &domainError{403, "Los eventos requieren el modo abierto: actívalo primero en tu perfil."}
	}
	b, e := t.blocked(id, ev.Owner)
	if e != nil {
		return e
	}
	if b {
		return denied()
	}
	old, exists := ev.Members[id]
	if exists && old.Status != "left" {
		return nil
	}
	if ev.Going >= ev.Capacity || len(ev.Members) >= 500 {
		return invalid("Ya está lleno.")
	}
	if !ev.Approval {
		if e = t.checkSchedule(id, ev.Starts, ev.Ends, "event:"+ev.ID); e != nil {
			return e
		}
	}
	status := "going"
	if ev.Approval {
		status = "pending"
	} else {
		ev.Going++
		p.Commitments["event:"+ev.ID] = true
	}
	if ev.Members == nil {
		ev.Members = map[string]member{}
	}
	m := member{Status: status, Joined: nowISO(), Rewarded: old.Rewarded}
	if status == "going" && !m.Rewarded {
		reward(p, 40, "Asistencia aceptada", "attend:"+ev.ID)
		m.Rewarded = true
		historyOnce(p, historyItem{ID: "event:" + ev.ID, Kind: "evento", Title: ev.Title, Category: ev.Type, Place: ev.Place, At: ev.Ends, Attendees: []string{ev.Owner, id}})
	}
	ev.Members[id] = m
	return t.save(eventsPK, ev.ID, ev)
}
func (h *Handler) applySocial(t *socialTx, p *personal, in socialAction) (any, error) {
	id := t.r.userID
	// Retire ended reservations when accepting a new commitment. Keeping these
	// references forever eventually exceeds DynamoDB's transaction item limit.
	if validChoice(in.Type, "publishPlan,publishEvent,jalo,joinEvent,respondInvite") {
		for ref := range p.Commitments {
			parts := strings.SplitN(ref, ":", 2)
			if len(parts) != 2 {
				delete(p.Commitments, ref)
				continue
			}
			keep := false
			if parts[0] == "plan" {
				var plan socialPlan
				if e := t.load(plansPK, parts[1], &plan); e != nil {
					return nil, e
				}
				keep = !plan.Canceled && active(plan.Expires) && plan.Members[id].Status == "going"
			} else {
				var ev socialEvent
				if e := t.load(eventsPK, parts[1], &ev); e != nil {
					return nil, e
				}
				keep = !ev.Canceled && active(ev.Ends) && ev.Members[id].Status == "going"
			}
			if !keep {
				delete(p.Commitments, ref)
			}
		}
		if len(p.Commitments) >= 40 {
			return nil, invalid("Tienes demasiados compromisos próximos; espera a que termine alguno.")
		}
		if e := t.putPerson(id, *p); e != nil {
			return nil, e
		}
	}
	switch in.Type {
	case "setLocation":
		if in.Location == nil || !validChoice(in.Location.Status, "granted,manual,denied") || in.Location.Center == nil || !validPoint(*in.Location.Center) {
			return nil, invalid("Elige una ubicación aproximada válida.")
		}
		c := approximate(*in.Location.Center)
		p.Location = chosenLocation{in.Location.Status, &c}
	case "setOpenMode":
		if in.Open == nil || in.Open.Enabled && !in.Open.Adult {
			return nil, invalid("Debes confirmar que tienes 18 años o más.")
		}
		p.Open = *in.Open
	case "setRadius":
		if !containsInt([]int{1000, 3000, 5000, 10000, 25000}, in.Radius) {
			return nil, invalid("Rango no válido.")
		}
		p.Radius = in.Radius
	case "setVisibilityRadius":
		if !containsInt([]int{500, 1000, 3000, 5000, 10000}, in.Radius) {
			return nil, invalid("Radio no válido.")
		}
		p.Visibility = in.Radius
	case "requestClose", "cancelClose", "acceptClose", "declineClose", "removeClose":
		ok, e := t.friends(id, in.UserID)
		if e != nil {
			return nil, e
		}
		b, e := t.blocked(id, in.UserID)
		if e != nil {
			return nil, e
		}
		if !ok || b {
			return nil, denied()
		}
		q, e := t.person(in.UserID)
		if e != nil {
			return nil, e
		}
		switch in.Type {
		case "requestClose":
			if p.Close[in.UserID] == "requested_in" {
				return nil, conflict("Tienes una solicitud entrante; debes aceptarla.")
			}
			if p.Close[in.UserID] != "" && p.Close[in.UserID] != "none" {
				return nil, conflict("La solicitud ya existe.")
			}
			p.Close[in.UserID] = "requested_out"
			q.Close[id] = "requested_in"
		case "acceptClose":
			if p.Close[in.UserID] != "requested_in" || q.Close[id] != "requested_out" {
				return nil, invalid("No hay solicitud pendiente.")
			}
			p.Close[in.UserID] = "mutual"
			q.Close[id] = "mutual"
		case "cancelClose":
			if p.Close[in.UserID] != "requested_out" {
				return nil, invalid("No hay solicitud enviada.")
			}
			delete(p.Close, in.UserID)
			delete(q.Close, id)
		case "declineClose":
			if p.Close[in.UserID] != "requested_in" {
				return nil, invalid("No hay solicitud recibida.")
			}
			delete(p.Close, in.UserID)
			delete(q.Close, id)
		case "removeClose":
			delete(p.Close, in.UserID)
			delete(q.Close, id)
			delete(p.Exact, in.UserID)
			delete(q.Exact, id)
			delete(p.ExactRequests, in.UserID)
			delete(q.ExactRequests, id)
		}
		return nil, t.putPerson(in.UserID, q)
	case "startExact", "stopExact", "askExact", "cancelAskExact", "declineExactRequest":
		ok, e := t.close(id, in.UserID)
		if e != nil {
			return nil, e
		}
		if !ok {
			return nil, denied()
		}
		q, e := t.person(in.UserID)
		if e != nil {
			return nil, e
		}
		switch in.Type {
		case "startExact":
			if !containsInt([]int{30, 60, 120, 240}, in.Minutes) {
				return nil, invalid("Duración no válida.")
			}
			p.GrantEpoch[in.UserID] = q.ExactEpoch
			p.Exact[in.UserID] = time.Now().Add(time.Duration(in.Minutes) * time.Minute).UTC().Format(time.RFC3339Nano)
			delete(p.ExactRequests, in.UserID)
		case "stopExact":
			delete(p.Exact, in.UserID)
		case "askExact":
			q.ExactRequests[id] = time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339Nano)
		case "cancelAskExact":
			delete(q.ExactRequests, id)
		case "declineExactRequest":
			delete(p.ExactRequests, in.UserID)
		}
		return nil, t.putPerson(in.UserID, q)
	case "updateName":
		name := strings.TrimSpace(in.Name)
		if utf8.RuneCountInString(name) < 2 || utf8.RuneCountInString(name) > 40 {
			return nil, invalid("El nombre debe tener entre 2 y 40 caracteres.")
		}
		return nil, t.changeAccount(id, func(u *models.User) { u.DisplayName = name })
	case "updateHandle":
		name := store.NormalizeUsername(in.Username)
		if !validUsername(name) {
			return nil, invalid("Usuario no válido.")
		}
		return nil, t.changeAccount(id, func(u *models.User) { u.Username = name })
	case "updateBio":
		if utf8.RuneCountInString(in.Bio) > 160 {
			return nil, invalid("Máximo 160 caracteres.")
		}
		p.Bio = strings.TrimSpace(in.Bio)
	case "setProfileImage":
		if !validChoice(in.MediaKind, "avatar,cover") || !validMediaKey(id, in.Key) {
			return nil, invalid("La imagen debe proceder de tu carga S3.")
		}
		if in.MediaKind == "avatar" {
			p.Avatar = in.Key
		} else {
			p.Cover = in.Key
		}
	case "saveDraft":
		if len(in.Draft) > 8192 {
			return nil, invalid("Borrador demasiado grande.")
		}
		if string(in.Draft) != "null" && len(in.Draft) > 0 {
			var d map[string]any
			if e := json.Unmarshal(in.Draft, &d); e != nil {
				return nil, invalid("Borrador no válido.")
			}
			if v, ok := d["type"]; ok {
				kind, _ := v.(string)
				if !validChoice(kind, "correr,deporte,juegos,comida,clase,musica,arte,otro") {
					return nil, invalid("Tipo de evento no válido.")
				}
			}
		}
		p.Draft = in.Draft
	case "swipe":
		if !validChoice(in.Kind, "plan,event") || !validChoice(in.Action, "pass,later") {
			return nil, invalid("Swipe no válido.")
		}
		if len(p.Swipes) >= 1000 {
			if _, ok := p.Swipes[in.Kind+":"+in.ID]; !ok {
				return nil, invalid("Límite de guardados alcanzado.")
			}
		}
		p.Swipes[in.Kind+":"+in.ID] = in.Action
	case "resetSwipes":
		if !validChoice(in.Kind, "plan,event") {
			return nil, invalid("Tipo no válido.")
		}
		for k, v := range p.Swipes {
			if strings.HasPrefix(k, in.Kind+":") && v == "pass" {
				delete(p.Swipes, k)
			}
		}
	case "publishPlan":
		if !validChoice(in.Category, "cafe,comer,correr,estudiar,gym,chill,fiesta,juegos") || utf8.RuneCountInString(strings.TrimSpace(in.Line)) < 3 || utf8.RuneCountInString(in.Line) > 160 || in.Duration < 5 || in.Duration > 1440 || !validChoice(in.Policy, "friends,friends_and_guests") || in.Place == nil || !validPoint(in.Place.Center) || len(strings.TrimSpace(in.Place.Name)) < 2 || len(in.Place.Name) > 160 || !validMediaKey(id, in.PhotoKey) || in.Capacity != 0 && (in.Capacity < 2 || in.Capacity > 100) {
			return nil, invalid("Plan no válido. El lugar público es obligatorio.")
		}
		end := instant(in.Starts).Add(time.Duration(in.Duration) * time.Minute).UTC().Format(time.RFC3339Nano)
		if !validTimes(in.Starts, end) || instant(in.Starts).Before(time.Now().Add(-2*time.Minute)) {
			return nil, invalid("Horario no válido.")
		}
		if e := t.checkSchedule(id, in.Starts, end, ""); e != nil {
			return nil, e
		}
		plan := socialPlan{ID: uuid.NewString(), Author: id, Category: in.Category, Line: strings.TrimSpace(in.Line), Starts: in.Starts, Duration: in.Duration, Expires: end, Policy: in.Policy, Place: *in.Place, Capacity: in.Capacity, Late: in.Late, PhotoKey: in.PhotoKey, MemberIDs: []string{}, Members: map[string]member{id: {Status: "going", Joined: nowISO()}}}
		p.Commitments["plan:"+plan.ID] = true
		if e := t.save(plansPK, plan.ID, plan); e != nil {
			return nil, e
		}
		if _, e := t.invite("plan", plan.ID, plan.Line, in.InviteIDs); e != nil {
			return nil, e
		}
		return plan, nil
	case "updatePlan", "removePlan", "endPlan", "leavePlan", "invitePeople", "jalo":
		var plan socialPlan
		if e := t.load(plansPK, in.ID, &plan); e != nil {
			return nil, e
		}
		if plan.ID == "" || plan.Canceled {
			return nil, invalid("Plan no encontrado.")
		}
		if in.Type == "jalo" {
			ok, e := t.canPlan(plan, id)
			if e != nil {
				return nil, e
			}
			if !ok {
				return nil, denied()
			}
			mid, e := t.joinPlan(p, &plan, false)
			return mid, e
		}
		if in.Type == "leavePlan" {
			if id == plan.Author {
				return nil, invalid("Debes cancelar el plan que organizas.")
			}
			if m, ok := plan.Members[id]; ok {
				if m.Status == "going" && m.Verified == "" && !joinedInProgress(plan, m) {
					// Cancelar tu lugar cuesta XP según qué tan cerca está el inicio; si quien organiza cambió hora o lugar hace < 2 h no hay penalización.
					if ch := instant(plan.Changed); plan.Changed == "" || time.Since(ch) > graceAfterEdit {
						xp, miss := cancelPenalty(int(time.Until(instant(plan.Starts)).Minutes()))
						penalize(p, xp, "Cancelaste tu lugar", "leave:"+plan.ID, miss)
					}
				}
				m.Status = "left"
				m.LeftAt = nowISO()
				plan.Members[id] = m
				plan.Joined--
				plan.MemberIDs = []string{}
				for uid, mem := range plan.Members {
					if uid != plan.Author && mem.Status == "going" {
						plan.MemberIDs = append(plan.MemberIDs, uid)
					}
				}
				delete(p.Commitments, "plan:"+plan.ID)
			}
			return nil, t.save(plansPK, plan.ID, plan)
		}
		if in.Type == "invitePeople" && plan.Author != id && plan.Policy == "friends_and_guests" && plan.Members[id].Status == "going" {
			n, e := t.invite("plan", plan.ID, plan.Line, in.InviteIDs)
			return n, e
		}
		if plan.Author != id {
			return nil, denied()
		}
		switch in.Type {
		case "removePlan":
			if plan.Joined > 0 && plan.Members[id].Verified == "" {
				xp, miss := cancelPenalty(int(time.Until(instant(plan.Starts)).Minutes()))
				penalize(p, xp, "Cancelaste tu plan", "cancel:"+plan.ID, miss)
			}
			plan.Canceled = true
			plan.CanceledAt = nowISO()
			delete(p.Commitments, "plan:"+plan.ID)
		case "endPlan":
			// Terminar ahora: solo un plan que ya empezó y no ha terminado. Conserva lo que duró.
			now := time.Now().UTC()
			if !instant(plan.Starts).Before(now) || !active(plan.Expires) {
				return nil, invalid("Solo puedes terminar un plan que está en curso.")
			}
			plan.Duration = max(1, int(now.Sub(instant(plan.Starts)).Minutes()))
			plan.Expires = now.Format(time.RFC3339Nano)
			if plan.Author == id {
				// Terminar tu plan: base + 5 XP por cada persona que de verdad llegó (hasta +25).
				arrived := 0
				for uid, m := range plan.Members {
					if uid != id && m.Status == "going" && m.Verified != "" {
						arrived++
					}
				}
				reward(p, finishXP+min(arrived*arrivedBonusXP, maxArrivedBonus), "Terminaste tu plan", "finish:"+plan.ID)
			}
		case "updatePlan":
			end := instant(in.Starts).Add(time.Duration(in.Duration) * time.Minute).UTC().Format(time.RFC3339Nano)
			if in.Duration < 5 || in.Duration > 1440 || !validTimes(in.Starts, end) {
				return nil, invalid("Horario no válido.")
			}
			for uid, m := range plan.Members {
				if m.Status == "going" {
					if e := t.checkSchedule(uid, in.Starts, end, "plan:"+plan.ID); e != nil {
						return nil, e
					}
				}
			}
			plan.Starts = in.Starts
			plan.Duration = in.Duration
			plan.Expires = end
			plan.Changed = nowISO()
		case "invitePeople":
			n, e := t.invite("plan", plan.ID, plan.Line, in.InviteIDs)
			return n, e
		}
		return nil, t.save(plansPK, plan.ID, plan)
	case "publishEvent":
		if !p.Open.Enabled || !p.Open.Adult {
			return nil, denied()
		}
		if !validChoice(in.EventType, "correr,deporte,juegos,comida,clase,musica,arte,otro") || utf8.RuneCountInString(strings.TrimSpace(in.Title)) < 3 || utf8.RuneCountInString(in.Title) > 100 || len(strings.TrimSpace(in.PlaceName)) < 2 || len(in.PlaceName) > 160 || in.Center == nil || !validPoint(*in.Center) || in.Capacity < 2 || in.Capacity > 200 || !validTimes(in.Starts, in.Ends) || !validMediaKey(id, in.PhotoKey) || len(in.Alias) > 50 || !validChoice(in.Verify, ",none,qr") {
			return nil, invalid("Evento no válido. Selecciona el lugar público en el mapa.")
		}
		if e := t.checkSchedule(id, in.Starts, in.Ends, ""); e != nil {
			return nil, e
		}
		ev := socialEvent{ID: uuid.NewString(), Owner: id, Type: in.EventType, Title: strings.TrimSpace(in.Title), Starts: in.Starts, Ends: in.Ends, Place: in.PlaceName, Center: *in.Center, Capacity: in.Capacity, Going: 1, Alias: strings.TrimSpace(in.Alias), Approval: in.Approval, Verify: eventVerify(in.Verify), Description: cleanText(in.Description, maxDescription), ChatEnabled: in.ChatEnabled != nil && *in.ChatEnabled, Late: in.Late, PhotoKey: in.PhotoKey, Friends: []string{}, XP: 40, Organizer: map[string]any{"name": "", "verified": false, "eventsCount": p.Events + 1}, Members: map[string]member{id: {Status: "going", Joined: nowISO()}}}
		p.Events++
		p.Draft = nil
		p.Commitments["event:"+ev.ID] = true
		if e := t.save(eventsPK, ev.ID, ev); e != nil {
			return nil, e
		}
		if _, e := t.invite("evento", ev.ID, ev.Title, in.InviteIDs); e != nil {
			return nil, e
		}
		reward(p, 60, "Evento organizado", "organize:"+ev.ID)
		return ev, nil
	case "updateEvent", "cancelEvent", "postAnnouncement", "deleteAnnouncement", "setEventChat", "eventMessage", "deleteEventMessage":
		var ev socialEvent
		if e := t.load(eventsPK, in.ID, &ev); e != nil {
			return nil, e
		}
		if ev.ID == "" || ev.Canceled {
			return nil, invalid("Evento no encontrado.")
		}
		owner := ev.Owner == id
		if in.Type != "eventMessage" && !owner {
			return nil, denied()
		}
		switch in.Type {
		case "cancelEvent":
			ev.Canceled = true
			delete(p.Commitments, "event:"+ev.ID)
		case "updateEvent":
			ends := in.Ends
			if utf8.RuneCountInString(strings.TrimSpace(in.Title)) < 3 || utf8.RuneCountInString(in.Title) > 100 || in.Capacity < max(2, ev.Going) || in.Capacity > 200 || !validTimes(in.Starts, ends) || len(strings.TrimSpace(in.PlaceName)) < 2 || len(in.PlaceName) > 160 || in.Center == nil || !validPoint(*in.Center) || !validMediaKey(id, in.PhotoKey) {
				return nil, invalid("Datos del evento no válidos.")
			}
			if e := t.checkSchedule(id, in.Starts, ends, "event:"+ev.ID); e != nil {
				return nil, e
			}
			ev.Title, ev.Starts, ev.Ends, ev.Capacity = strings.TrimSpace(in.Title), in.Starts, ends, in.Capacity
			ev.Place, ev.Center = in.PlaceName, *in.Center
			ev.Description = cleanText(in.Description, maxDescription)
			ev.Late, ev.Approval = in.Late, in.Approval
			if in.PhotoKey != "" {
				ev.PhotoKey = in.PhotoKey
			}
		case "postAnnouncement":
			text := cleanText(in.Message, maxAnnounceRunes)
			if text == "" {
				return nil, invalid("Escribe el aviso (hasta 500 caracteres).")
			}
			if len(ev.Announcements) >= maxAnnouncements {
				return nil, invalid("Ya hay muchos avisos: borra alguno antes de publicar otro.")
			}
			ev.Announcements = append(ev.Announcements, announcement{ID: uuid.NewString(), Text: text, At: nowISO()})
		case "deleteAnnouncement":
			kept := ev.Announcements[:0:0]
			for _, an := range ev.Announcements {
				if an.ID != in.Message {
					kept = append(kept, an)
				}
			}
			ev.Announcements = kept
		case "setEventChat":
			ev.ChatEnabled = in.Accept
		case "deleteEventMessage":
			kept := ev.Timeline[:0:0]
			for _, m := range ev.Timeline {
				if m.ID != in.Message {
					kept = append(kept, m)
				}
			}
			ev.Timeline = kept
		case "eventMessage":
			m := ev.Members[id]
			if !ev.ChatEnabled {
				return nil, invalid("Quien organiza no activó el chat.")
			}
			if !owner && m.Status != "going" {
				return nil, denied()
			}
			text, ok := cleanChat(in.Message)
			if !ok {
				return nil, invalid("Escribe un mensaje (hasta 280 caracteres).")
			}
			if m.LastMsgAt != "" && time.Since(instant(m.LastMsgAt)) < messageCooldown {
				return nil, invalid("Vas muy rápido: espera un segundo.")
			}
			m.LastMsgAt = nowISO()
			ev.Members[id] = m
			ev.Timeline = append(ev.Timeline, planMsg{ID: uuid.NewString(), User: id, Text: text, At: nowISO()})
			if len(ev.Timeline) > maxTimeline {
				ev.Timeline = ev.Timeline[len(ev.Timeline)-maxTimeline:]
			}
		}
		return nil, t.save(eventsPK, ev.ID, ev)
	case "joinEvent", "leaveEvent", "setPace", "approveAttendance", "rejectAttendance":
		var ev socialEvent
		if e := t.load(eventsPK, in.ID, &ev); e != nil {
			return nil, e
		}
		if ev.ID == "" || ev.Canceled {
			return nil, invalid("Evento no encontrado.")
		}
		if in.Type == "joinEvent" {
			return nil, t.joinEvent(p, &ev)
		}
		uid := id
		if in.Type == "approveAttendance" || in.Type == "rejectAttendance" {
			if ev.Owner != id {
				return nil, denied()
			}
			uid = in.UserID
		}
		m, exists := ev.Members[uid]
		if !exists {
			return nil, invalid("Asistencia no encontrada.")
		}
		switch in.Type {
		case "leaveEvent", "rejectAttendance":
			if uid == ev.Owner {
				return nil, invalid("No puedes salir de un evento que organizas.")
			}
			if m.Status == "going" {
				ev.Going--
			}
			m.Status = "left"
			if uid == id {
				delete(p.Commitments, "event:"+ev.ID)
			} else {
				q, e := t.person(uid)
				if e != nil {
					return nil, e
				}
				delete(q.Commitments, "event:"+ev.ID)
				if e = t.putPerson(uid, q); e != nil {
					return nil, e
				}
			}
		case "setPace":
			if len(in.Pace) > 40 || m.Status == "left" {
				return nil, invalid("Ritmo no válido.")
			}
			m.Pace = in.Pace
		case "approveAttendance":
			if e := t.requireJoin(uid, ev.Starts, ev.Ends, ev.Late); e != nil {
				return nil, e
			}
			if m.Status != "pending" {
				return nil, invalid("No hay solicitud pendiente.")
			}
			if ev.Going >= ev.Capacity {
				return nil, invalid("Ya está lleno.")
			}
			b, e := t.blocked(id, uid)
			if e != nil {
				return nil, e
			}
			if b {
				return nil, denied()
			}
			if e = t.checkSchedule(uid, ev.Starts, ev.Ends, "event:"+ev.ID); e != nil {
				return nil, e
			}
			q, e := t.person(uid)
			if e != nil {
				return nil, e
			}
			q.Commitments["event:"+ev.ID] = true
			if !m.Rewarded {
				reward(&q, 40, "Asistencia aceptada", "attend:"+ev.ID)
				m.Rewarded = true
				historyOnce(&q, historyItem{ID: "event:" + ev.ID, Kind: "evento", Title: ev.Title, Category: ev.Type, Place: ev.Place, At: ev.Ends, Attendees: []string{ev.Owner, uid}})
			}
			if e = t.putPerson(uid, q); e != nil {
				return nil, e
			}
			m.Status = "going"
			ev.Going++
		}
		ev.Members[uid] = m
		return nil, t.save(eventsPK, ev.ID, ev)
	case "respondInvite":
		var inv invitation
		if e := t.load("invites.v2", in.ID, &inv); e != nil {
			return nil, e
		}
		if inv.ID == "" || inv.To != id || inv.Status != "pending" {
			return nil, invalid("La invitación ya no está pendiente.")
		}
		result := map[string]any{"ok": true}
		if in.Accept {
			b, e := t.blocked(id, inv.From)
			if e != nil {
				return nil, e
			}
			if b {
				return nil, denied()
			}
			if inv.Kind == "plan" {
				var plan socialPlan
				if e = t.load(plansPK, inv.Target, &plan); e != nil {
					return nil, e
				}
				if inv.From != plan.Author {
					if plan.Members[inv.From].Status != "going" || plan.Policy != "friends_and_guests" {
						return nil, denied()
					}
				}
				mid, e := t.joinPlan(p, &plan, true)
				if e != nil {
					return nil, e
				}
				result["matchId"] = mid
			} else {
				var ev socialEvent
				if e = t.load(eventsPK, inv.Target, &ev); e != nil {
					return nil, e
				}
				if e = t.joinEvent(p, &ev); e != nil {
					return nil, e
				}
			}
			inv.Status = "accepted"
		} else {
			inv.Status = "declined"
		}
		if e := t.save("invites.v2", inv.ID, inv); e != nil {
			return nil, e
		}
		for _, uid := range []string{inv.From, inv.To} {
			if e := t.save("user#"+uid, "invite#"+inv.ID, inv); e != nil {
				return nil, e
			}
		}
		return result, nil
	case "verifyTogether", "confirmMeet", "quickMessage":
		var m socialMatch
		if e := t.load("matches.v2", in.ID, &m); e != nil {
			return nil, e
		}
		if m.ID == "" || id != m.Host && id != m.Guest {
			return nil, denied()
		}
		var plan socialPlan
		if e := t.load(plansPK, m.PlanID, &plan); e != nil {
			return nil, e
		}
		if plan.Canceled || !active(plan.Expires) || plan.Members[id].Status != "going" {
			return nil, invalid("El plan terminó o fue cancelado.")
		}
		other := m.Host
		if other == id {
			other = m.Guest
		}
		b, e := t.blocked(id, other)
		if e != nil {
			return nil, e
		}
		if b || plan.Members[other].Status != "going" {
			return nil, denied()
		}
		switch in.Type {
		case "quickMessage":
			if !validChoice(in.Message, "Voy en 10,Ya llegué,Se me complicó") {
				return nil, invalid("Mensaje no válido.")
			}
			m.Messages[id] = in.Message
		case "verifyTogether":
			if instant(plan.Starts).Add(-30*time.Minute).After(time.Now()) || in.Center == nil || !validPoint(*in.Center) {
				return nil, invalid("La verificación se activa 30 minutos antes del plan.")
			}
			if dist(*in.Center, plan.Place.Center) > 100 {
				return nil, invalid("Debes estar a menos de 100 m del punto de encuentro.")
			}
			mem := plan.Members[id]
			if mem.Verified == "" {
				mem.Verified = nowISO()
				plan.Members[id] = mem
			}
			if e = t.save(plansPK, plan.ID, plan); e != nil {
				return nil, e
			}
			return map[string]bool{"together": true}, nil
		case "confirmMeet":
			if plan.Members[id].Verified == "" {
				return nil, invalid("Primero verifica que llegaste al punto de encuentro.")
			}
			m.Confirmed[id] = true
			if m.Confirmed[m.Host] && m.Confirmed[m.Guest] && !m.Rewarded {
				if plan.Members[other].Verified == "" {
					return nil, invalid("Falta la verificación de la otra persona.")
				}
				q, e := t.person(other)
				if e != nil {
					return nil, e
				}
				members := []string{}
				for uid, mem := range plan.Members {
					if mem.Status == "going" {
						members = append(members, uid)
					}
				}
				item := historyItem{ID: "plan:" + plan.ID, Kind: "plan", Title: plan.Line, Category: plan.Category, Place: plan.Place.Name, At: nowISO(), Attendees: members}
				for _, person := range []*personal{p, &q} {
					found := false
					for _, v := range person.History {
						if v.ID == item.ID {
							found = true
						}
					}
					if !found {
						reward(person, 20, "Ya nos vimos", item.ID)
						person.Hangouts++
						historyOnce(person, item)
					}
				}
				if e = t.putPerson(other, q); e != nil {
					return nil, e
				}
				m.Rewarded = true
			}
		}
		return nil, t.save("matches.v2", m.ID, m)
	case "checkIn", "confirmArrival", "planMessage", "setChatTheme", "deleteChatMessage":
		var plan socialPlan
		if e := t.load(plansPK, in.ID, &plan); e != nil {
			return nil, e
		}
		if plan.ID == "" || plan.Canceled || plan.Members[id].Status != "going" {
			return nil, invalid("Plan no disponible.")
		}
		if !active(plan.Expires) {
			return nil, invalid("El plan ya terminó.")
		}
		if (in.Type == "setChatTheme" || in.Type == "deleteChatMessage") && plan.Author != id {
			return nil, denied()
		}
		if in.Type != "planMessage" && in.Type != "setChatTheme" && in.Type != "deleteChatMessage" && instant(plan.Starts).Add(-checkInLeadMin*time.Minute).After(time.Now()) {
			return nil, invalid("Se abre 10 minutos antes del plan.")
		}
		attend := func(person *personal, uid string) (int, string) {
			ids := []string{}
			for k, m := range plan.Members {
				if m.Status == "going" {
					ids = append(ids, k)
				}
			}
			item := historyItem{ID: "plan:" + plan.ID, Kind: "plan", Title: plan.Line, Category: plan.Category, Place: plan.Place.Name, At: nowISO(), Attendees: ids}
			xp, label := arrivalXP(dueAt(plan, plan.Members[uid]), time.Now())
			reward(person, xp, "Llegaste al plan · "+label, "checkin:"+plan.ID)
			person.Hangouts++
			historyOnce(person, item)
			addRecord(person, "ok")
			return xp, label
		}
		var result any
		switch in.Type {
		case "checkIn":
			here := in.Center
			if here == nil {
				// Sin lectura del dispositivo: se usa tu última ubicación conocida (aproximada, de los últimos 5 min).
				last, e := t.h.App.Loc.GetManyLast(t.r.ctx, []string{id})
				if e != nil {
					return nil, e
				}
				if l, ok := last[id]; ok && time.Since(time.UnixMilli(l.TS)) < 5*time.Minute {
					here = &point{l.Lat, l.Lng}
				}
			}
			if here == nil || !validPoint(*here) {
				return nil, invalid("No pudimos ubicarte. Revisa el permiso de ubicación o pide que te confirmen.")
			}
			if away := dist(*here, plan.Place.Center); away > checkInMeters {
				return nil, invalid(fmt.Sprintf("Aún no estás en el lugar (estás a unos %d m). Acércate un poco más.", (away+25)/50*50))
			}
			mem := plan.Members[id]
			if mem.Verified == "" {
				mem.Verified = nowISO()
				plan.Members[id] = mem
				xp, label := attend(p, id)
				result = map[string]any{"xp": xp, "punctuality": label}
			}
		case "confirmArrival":
			if (plan.Members[id].Verified == "" && plan.Author != id) || in.UserID == id {
				return nil, invalid("Primero haz tu check-in (quien organiza puede confirmar sin él).")
			}
			target := plan.Members[in.UserID]
			if target.Status != "going" {
				return nil, invalid("Esa persona no va en este plan.")
			}
			if target.Verified == "" {
				q, e := t.person(in.UserID)
				if e != nil {
					return nil, e
				}
				target.Verified = nowISO()
				target.ConfirmedBy = id
				plan.Members[in.UserID] = target
				attend(&q, in.UserID)
				if e = t.putPerson(in.UserID, q); e != nil {
					return nil, e
				}
			}
		case "setChatTheme":
			if !validChoice(in.Message, chatThemes) {
				return nil, invalid("Tema no válido.")
			}
			plan.ChatTheme = in.Message
		case "deleteChatMessage":
			kept := plan.Timeline[:0:0]
			for _, m := range plan.Timeline {
				if m.ID != in.Message {
					kept = append(kept, m)
				}
			}
			plan.Timeline = kept
		case "planMessage":
			text, ok := cleanChat(in.Message)
			if !ok {
				return nil, invalid("Escribe un mensaje (hasta 280 caracteres).")
			}
			mem := plan.Members[id]
			if mem.LastMsgAt != "" && time.Since(instant(mem.LastMsgAt)) < messageCooldown {
				return nil, invalid("Vas muy rápido: espera un segundo.")
			}
			mem.LastMsgAt = nowISO()
			plan.Members[id] = mem
			plan.Timeline = append(plan.Timeline, planMsg{ID: uuid.NewString(), User: id, Text: text, At: nowISO()})
			if len(plan.Timeline) > maxTimeline {
				plan.Timeline = plan.Timeline[len(plan.Timeline)-maxTimeline:]
			}
		}
		return result, t.save(plansPK, plan.ID, plan)
	case "settleNoShows":
		// Planes que ya terminaron y a los que dijiste que ibas sin hacer check-in: falta (−80 XP, cuenta en tu confiabilidad).
		refs := []string{}
		for ref := range p.Commitments {
			if strings.HasPrefix(ref, "plan:") {
				refs = append(refs, ref)
			}
		}
		for _, ref := range refs {
			var plan socialPlan
			if e := t.load(plansPK, strings.TrimPrefix(ref, "plan:"), &plan); e != nil {
				return nil, e
			}
			if plan.ID == "" || active(plan.Expires) {
				continue
			}
			mem := plan.Members[id]
			if !plan.Canceled && mem.Status == "going" && mem.Verified == "" && !mem.Settled && !joinedInProgress(plan, mem) {
				penalize(p, noShowPenalty, "No llegaste a un plan", "noshow:"+plan.ID, true)
				mem.Settled = true
				plan.Members[id] = mem
				if e := t.save(plansPK, plan.ID, plan); e != nil {
					return nil, e
				}
			}
			delete(p.Commitments, ref)
		}
	case "block", "report":
		if in.UserID == id {
			return nil, invalid("Usuario no válido.")
		}
		if _, e := t.user(in.UserID); e != nil {
			return nil, e
		}
		if in.Type == "block" {
			if !contains(p.Blocks, in.UserID) {
				if len(p.Blocks) >= 500 {
					return nil, invalid("Límite de bloqueos alcanzado.")
				}
				p.Blocks = append(p.Blocks, in.UserID)
			}
			return nil, t.clearPair(p, in.UserID)
		}
		if !validChoice(in.Reason, "Spam o cuenta falsa,Acoso o mensajes ofensivos,Contenido inapropiado,Otro motivo") {
			return nil, invalid("Motivo no válido.")
		}
		return nil, t.save("reports", id+"#"+in.UserID, map[string]string{"reporter": id, "userId": in.UserID, "reason": in.Reason, "at": nowISO()})
	default:
		return nil, invalid("Acción no válida.")
	}
	return nil, nil
}
func containsInt(list []int, value int) bool {
	for _, n := range list {
		if n == value {
			return true
		}
	}
	return false
}

// eventVerify: cómo se verifica a los asistentes. Sin dato = sin verificación (check-in por geocerca).
func eventVerify(v string) string {
	if v == "qr" {
		return "qr"
	}
	return "none"
}

package api

import (
	"encoding/json"
	"github.com/google/uuid"
	"sort"
	"strings"
	"time"

	"github.com/isaac-evs/friends_nearby/backend/internal/location"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
)

func (t *socialTx) mediaURL(key string) string {
	return t.h.App.Cfg.MediaURL(key)
}
func (t *socialTx) userView(u *models.User) (map[string]any, error) {
	p, e := t.person(u.UserID)
	if e != nil {
		return nil, e
	}
	ids, e := t.h.App.Store.AcceptedFriendIDs(t.r.ctx, u.UserID)
	if e != nil {
		return nil, e
	}
	out := map[string]any{"id": u.UserID, "name": u.DisplayName, "handle": "@" + u.Username, "level": p.Level, "streakWeeks": streak(p.History), "hangouts": p.Hangouts, "eventsCount": p.Events, "totalXp": max(0, (p.Level-1)*500+p.XP), "friendsCount": len(ids)}
	if p.Bio != "" {
		out["bio"] = p.Bio
	}
	avatar := p.Avatar
	if avatar == "" {
		avatar = u.PhotoKey
	}
	if url := t.mediaURL(avatar); url != "" {
		out["avatarUrl"] = url
	}
	if url := t.mediaURL(p.Cover); url != "" {
		out["coverUrl"] = url
	}
	return out, nil
}
func (h *Handler) socialUser(r *request) httpResp {
	id := r.ev.QueryStringParameters["id"]
	if id == "" {
		var e error
		id, e = h.App.Store.UserIDByUsername(r.ctx, strings.TrimPrefix(r.ev.QueryStringParameters["username"], "@"))
		if e != nil {
			return internalError("find user", e)
		}
	}
	if id == "" {
		return respond(404, errBody("Usuario no encontrado."))
	}
	t := newSocialTx(h, r)
	b, e := t.blocked(r.userID, id)
	if e != nil {
		return responseError(e)
	}
	if b {
		return respond(404, errBody("Usuario no encontrado."))
	}
	u, e := h.App.Store.GetUser(r.ctx, id)
	if e != nil {
		return responseError(e)
	}
	if u == nil || strings.Contains(u.UserID, "#") {
		return respond(404, errBody("Usuario no encontrado."))
	}
	v, e := t.userView(u)
	if e != nil {
		return responseError(e)
	}
	return respond(200, v)
}
func (h *Handler) appState(r *request) httpResp {
	v, e := h.buildState(r)
	if e != nil {
		return responseError(e)
	}
	return respond(200, v)
}
func (t *socialTx) canPlan(p socialPlan, id string) (bool, error) {
	if p.Canceled {
		return false, nil
	}
	b, e := t.blocked(id, p.Author)
	if e != nil || b {
		return false, e
	}
	if id == p.Author || p.Members[id].Status == "going" {
		return true, nil
	}
	yes, e := t.friends(id, p.Author)
	if e != nil || yes {
		return yes, e
	}
	// A pending invitation permits seeing the public venue, never a person's location.
	d, e := t.h.App.Store.ListDocuments(t.r.ctx, "user#"+id)
	if e != nil {
		return false, e
	}
	for _, doc := range d {
		if !strings.HasPrefix(doc.SK, "invite#") {
			continue
		}
		var inv invitation
		if e = json.Unmarshal(doc.Data, &inv); e != nil {
			return false, e
		}
		if inv.Target == p.ID && inv.To == id && inv.Status == "pending" {
			return true, nil
		}
	}
	return false, nil
}
func (t *socialTx) canEvent(e socialEvent, id string) (bool, error) {
	if e.Canceled {
		return false, nil
	}
	b, err := t.blocked(id, e.Owner)
	if err != nil || b {
		return false, err
	}
	if id == e.Owner || e.Members[id].Status == "going" || e.Members[id].Status == "pending" {
		return true, nil
	}
	p, err := t.person(id)
	return p.Open.Enabled && p.Open.Adult, err
}
func dist(a, b point) int {
	return int(location.DistanceM(models.Location{Lat: a.Lat, Lng: a.Lng}, models.Location{Lat: b.Lat, Lng: b.Lng}))
}
func (h *Handler) buildState(r *request) (map[string]any, error) {
	t := newSocialTx(h, r)
	p, e := t.person(r.userID)
	if e != nil {
		return nil, e
	}
	me, e := h.App.Store.GetUser(r.ctx, r.userID)
	if e != nil {
		return nil, e
	}
	if me == nil {
		return nil, denied()
	}
	center := point{}
	if p.Location.Center != nil {
		center = *p.Location.Center
	}
	own, e := h.App.Loc.Get(r.ctx, r.userID)
	if e != nil {
		return nil, e
	}
	if own != nil {
		center = point{own.Lat, own.Lng}
	}
	users := map[string]any{}
	friendships := map[string]any{}
	plans := []socialPlan{}
	events := []socialEvent{}
	matches := []map[string]any{}
	presence := []map[string]any{}
	// Amigos (cercanos o no): SOLO a cuántos metros andan, redondeado a 100 m y sin coordenadas; nunca aparecen en el mapa.
	distances := []map[string]any{}
	shares := []map[string]string{}
	grants := []map[string]string{}
	exactPending := []string{}
	incomingExact := []string{}
	exactLocations := map[string]point{}
	invites := []invitation{}
	attendances := []map[string]any{}
	attendees := map[string][]string{}
	pendingAttendees := map[string][]string{}
	myHistory := []historyItem{}
	addUser := func(id string) error {
		if _, ok := users[id]; ok {
			return nil
		}
		blocked, e := t.blocked(r.userID, id)
		if e != nil || blocked {
			return e
		}
		u, e := h.App.Store.GetUser(r.ctx, id)
		if e != nil || u == nil {
			return e
		}
		v, e := t.userView(u)
		if e == nil {
			users[id] = v
		}
		return e
	}
	if e = addUser(r.userID); e != nil {
		return nil, e
	}
	rows, e := h.App.Store.ListFriendships(r.ctx, r.userID)
	if e != nil {
		return nil, e
	}
	locIDs := []string{}
	for _, f := range rows {
		if f.Status == models.StatusAccepted {
			locIDs = append(locIDs, f.FriendID)
		}
	}
	locs, e := h.App.Loc.GetManyLast(r.ctx, locIDs)
	if e != nil {
		return nil, e
	}
	for _, f := range rows {
		blocked, e := t.blocked(r.userID, f.FriendID)
		if e != nil {
			return nil, e
		}
		if blocked {
			continue
		}
		if e = addUser(f.FriendID); e != nil {
			return nil, e
		}
		q, e := t.person(f.FriendID)
		if e != nil {
			return nil, e
		}
		u, e := h.App.Store.GetUser(r.ctx, f.FriendID)
		if e != nil {
			return nil, e
		}
		if u == nil {
			continue
		}
		close := "none"
		if f.Status == models.StatusAccepted {
			close = p.Close[f.FriendID]
			if close == "" {
				close = "none"
			}
		}
		mutual := close == "mutual" && q.Close[r.userID] == "mutual"
		loc, live := locs[f.FriendID]
		// Un cercano mutuo siempre te ve (sin radio de visibilidad); solo cuenta tu propio rango de búsqueda.
		visible := mutual && live && dist(center, point{loc.Lat, loc.Lng}) <= p.Radius
		common := []string{}
		otherFriends, e := h.App.Store.AcceptedFriendIDs(r.ctx, f.FriendID)
		if e != nil {
			return nil, e
		}
		for _, fr := range rows {
			if fr.Status == models.StatusAccepted && contains(otherFriends, fr.FriendID) {
				common = append(common, fr.FriendID)
			}
		}
		status := map[string]string{models.StatusAccepted: "friends", models.StatusPendingIn: "requested_in", models.StatusPendingOut: "requested_out"}[f.Status]
		friendships[f.FriendID] = map[string]any{"userId": f.FriendID, "status": status, "close": close, "mutualFriendIds": common, "locationPaused": !visible}
		if live && f.Status == models.StatusAccepted && (p.Location.Center != nil || own != nil) {
			distances = append(distances, map[string]any{"userId": f.FriendID, "distanceM": friendDistance(dist(center, point{loc.Lat, loc.Lng})), "updatedAt": time.UnixMilli(loc.TS).UTC().Format(time.RFC3339Nano)})
		}
		if visible {
			presence = append(presence, map[string]any{"userId": f.FriendID, "cell": point{loc.Lat, loc.Lng}, "updatedAt": time.UnixMilli(loc.TS).UTC().Format(time.RFC3339Nano)})
		}
		if mutual {
			if until := p.Exact[f.FriendID]; active(until) && p.GrantEpoch[f.FriendID] == q.ExactEpoch {
				shares = append(shares, map[string]string{"userId": f.FriendID, "until": until})
			}
			if until := q.Exact[r.userID]; active(until) && q.GrantEpoch[r.userID] == p.ExactEpoch {
				grants = append(grants, map[string]string{"userId": f.FriendID, "until": until})
				raw, e := h.App.Loc.GetExact(r.ctx, f.FriendID)
				if e != nil {
					return nil, e
				}
				if raw != nil {
					exactLocations[f.FriendID] = point{raw.Lat, raw.Lng}
				}
			}
			if active(q.ExactRequests[r.userID]) {
				exactPending = append(exactPending, f.FriendID)
			}
			if active(p.ExactRequests[f.FriendID]) {
				incomingExact = append(incomingExact, f.FriendID)
			}
		}
	}
	ownDocs, e := h.App.Store.ListDocuments(r.ctx, "user#"+r.userID)
	if e != nil {
		return nil, e
	}
	for _, d := range ownDocs {
		if strings.HasPrefix(d.SK, "invite#") {
			var inv invitation
			if e = json.Unmarshal(d.Data, &inv); e != nil {
				return nil, e
			}
			other := inv.From
			if other == r.userID {
				other = inv.To
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
			invites = append(invites, inv)
		}
	}
	// Read authoritative entities. No embedded match snapshot can recreate a
	// canceled plan, and GPS presence is never required to publish a public venue.
	planDocs, e := h.App.Store.ListDocuments(r.ctx, plansPK)
	if e != nil {
		return nil, e
	}
	planByID := map[string]socialPlan{}
	pastPlans := []socialPlan{}
	canceled := []map[string]any{}
	for _, d := range planDocs {
		var plan socialPlan
		if e = json.Unmarshal(d.Data, &plan); e != nil {
			return nil, e
		}
		if plan.ID != "" {
			// Historial de cancelados: planes que se cancelaron (los organizaste o ibas) y planes de los que saliste.
			if c, ok := canceledEntry(r.userID, plan); ok {
				canceled = append(canceled, c)
			}
		}
		if plan.ID != "" && !plan.Canceled && !active(plan.Expires) {
			// Historial: los planes que ya terminaron siguen a la vista (con su chat) para quienes fueron.
			if past, ok, e := t.pastPlanFor(r.userID, plan, addUser); e != nil {
				return nil, e
			} else if ok {
				pastPlans = append(pastPlans, past)
			}
			continue
		}
		if plan.ID == "" || plan.Canceled || !active(plan.Expires) {
			continue
		}
		candidate := plan.Author == r.userID || plan.Members[r.userID].Status == "going" || contains(locIDs, plan.Author)
		for _, inv := range invites {
			if inv.Target == plan.ID && inv.To == r.userID && inv.Status == "pending" {
				candidate = true
			}
		}
		if !candidate {
			continue
		}
		ok, e := t.canPlan(plan, r.userID)
		if e != nil {
			return nil, e
		}
		if !ok {
			continue
		}
		ownOrJoined := plan.Author == r.userID || plan.Members[r.userID].Status == "going"
		invited := false
		for _, inv := range invites {
			if inv.Target == plan.ID && inv.To == r.userID && inv.Status == "pending" {
				invited = true
			}
		}
		if !ownOrJoined && !invited && (p.Location.Center == nil || dist(center, plan.Place.Center) > p.Radius) {
			continue
		}
		if e = addUser(plan.Author); e != nil {
			return nil, e
		}
		plan.MemberIDs = []string{}
		for uid, m := range plan.Members {
			if m.Status != "going" {
				continue
			}
			b, e := t.blocked(r.userID, uid)
			if e != nil {
				return nil, e
			}
			if b {
				continue
			}
			// Quien llegó por una invitación (amigo de un amigo) no ve a desconocidos: solo a sus propios amigos.
			if !ownOrJoined && uid != plan.Author && uid != r.userID {
				if fr, e := t.friends(r.userID, uid); e != nil {
					return nil, e
				} else if !fr {
					continue
				}
			}
			plan.MemberIDs = append(plan.MemberIDs, uid)
			if e = addUser(uid); e != nil {
				return nil, e
			}
		}
		plan.Photo = t.mediaURL(plan.PhotoKey)
		planByID[plan.ID] = plan
		plan.Roster = nil
		if ownOrJoined {
			for uid, m := range plan.Members {
				if m.Status == "going" && contains(plan.MemberIDs, uid) || uid == plan.Author {
					plan.Roster = append(plan.Roster, rosterEntry{UserID: uid, Organizer: uid == plan.Author, ArrivedAt: m.Verified, ConfirmedBy: m.ConfirmedBy, JoinedAt: m.Joined})
				}
			}
			// "A cuánto está del lugar": solo entre integrantes, desde 10 min antes, de quien aún no llega, con su última
			// ubicación reciente y sin modo fantasma. Se entrega la distancia a un punto público, redondeada a 100 m; jamás coordenadas.
			if begin := instant(plan.Starts).Add(-checkInLeadMin * time.Minute); !time.Now().Before(begin) {
				pending := []string{}
				for _, re := range plan.Roster {
					if re.ArrivedAt == "" {
						pending = append(pending, re.UserID)
					}
				}
				near, e := h.App.Loc.GetManyLast(r.ctx, pending)
				if e != nil {
					return nil, e
				}
				for i, re := range plan.Roster {
					loc, ok := near[re.UserID]
					if re.ArrivedAt != "" || !ok || time.Since(time.UnixMilli(loc.TS)) > staleLocation {
						continue
					}
					u, e := h.App.Store.GetUser(r.ctx, re.UserID)
					if e != nil {
						return nil, e
					}
					if u == nil || u.GhostMode {
						continue
					}
					d := friendDistance(dist(plan.Place.Center, point{loc.Lat, loc.Lng}))
					plan.Roster[i].DistanceM = &d
					plan.Roster[i].LocAt = time.UnixMilli(loc.TS).UTC().Format(time.RFC3339Nano)
				}
			}
		} else {
			plan.Timeline = nil
		}
		plan.Members = nil
		plans = append(plans, plan)
	}
	for _, d := range ownDocs {
		if !strings.HasPrefix(d.SK, "match#") {
			continue
		}
		var m socialMatch
		if e = t.load("matches.v2", strings.TrimPrefix(d.SK, "match#"), &m); e != nil {
			return nil, e
		}
		plan, ok := planByID[m.PlanID]
		if !ok {
			continue
		}
		other := m.Host
		if other == r.userID {
			other = m.Guest
		}
		if plan.Members[r.userID].Status != "going" || plan.Members[other].Status != "going" {
			continue
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
		verified := any(nil)
		if plan.Members[r.userID].Verified != "" {
			verified = plan.Members[r.userID].Verified
		}
		matches = append(matches, map[string]any{"id": m.ID, "planId": m.PlanID, "friendId": other, "createdAt": m.Created, "togetherAt": verified, "meetPoint": plan.Place.Name, "quickMessage": m.Messages[r.userID], "receivedMessage": m.Messages[other], "myConfirmed": m.Confirmed[r.userID], "theirConfirmed": m.Confirmed[other], "rewarded": m.Rewarded})
	}
	eventDocs, e := h.App.Store.ListDocuments(r.ctx, eventsPK)
	if e != nil {
		return nil, e
	}
	for _, d := range eventDocs {
		var ev socialEvent
		if e = json.Unmarshal(d.Data, &ev); e != nil {
			return nil, e
		}
		if ev.ID == "" || ev.Canceled || !active(ev.Ends) {
			continue
		}
		if ev.Owner != r.userID && ev.Members[r.userID].Status != "going" && ev.Members[r.userID].Status != "pending" && (!p.Open.Enabled || !p.Open.Adult || !p.Open.Big || p.Location.Center == nil || dist(center, ev.Center) > p.Radius) {
			continue
		}
		ok, e := t.canEvent(ev, r.userID)
		if e != nil {
			return nil, e
		}
		if !ok {
			continue
		}
		mine := ev.Owner == r.userID
		membership := ev.Members[r.userID]
		joined := membership.Status == "going" || membership.Status == "pending"
		if !mine && !joined && (!p.Open.Big || p.Location.Center == nil || dist(center, ev.Center) > p.Radius) {
			continue
		}
		if e = addUser(ev.Owner); e != nil {
			return nil, e
		}
		attendees[ev.ID] = []string{}
		pendingAttendees[ev.ID] = []string{}
		ev.Friends = []string{}
		for uid, m := range ev.Members {
			b, e := t.blocked(r.userID, uid)
			if e != nil {
				return nil, e
			}
			if b {
				continue
			}
			if uid == r.userID && uid != ev.Owner && m.Status != "left" {
				attendances = append(attendances, map[string]any{"eventId": ev.ID, "pace": m.Pace, "joinedAt": m.Joined, "status": m.Status})
			}
			if m.Status == "going" {
				attendees[ev.ID] = append(attendees[ev.ID], uid)
				if e = addUser(uid); e != nil {
					return nil, e
				}
				if contains(locIDs, uid) {
					ev.Friends = append(ev.Friends, uid)
				}
			} else if mine && m.Status == "pending" {
				pendingAttendees[ev.ID] = append(pendingAttendees[ev.ID], uid)
				if e = addUser(uid); e != nil {
					return nil, e
				}
			}
		}
		owner, e := h.App.Store.GetUser(r.ctx, ev.Owner)
		if e != nil {
			return nil, e
		}
		name := ""
		if owner != nil {
			name = owner.DisplayName
		}
		ev.Organizer = map[string]any{"name": name, "verified": false, "eventsCount": 0}
		if ev.Alias != "" {
			ev.Organizer["alias"] = ev.Alias
		}
		ev.Photo = t.mediaURL(ev.PhotoKey)
		if !mine && ev.Members[r.userID].Status != "going" {
			ev.Timeline = nil
		}
		ev.Members = nil
		events = append(events, ev)
	}
	for _, item := range p.History {
		if instant(item.At).After(time.Now()) {
			continue
		}
		visibleIDs := []string{}
		for _, id := range item.Attendees {
			b, e := t.blocked(r.userID, id)
			if e != nil {
				return nil, e
			}
			if !b {
				visibleIDs = append(visibleIDs, id)
				if e = addUser(id); e != nil {
					return nil, e
				}
			}
		}
		item.Attendees = visibleIDs
		myHistory = append(myHistory, item)
	}
	for i, includeID := range strings.Split(r.ev.QueryStringParameters["includeUsers"], ",") {
		if i >= 20 {
			break
		}
		if _, err := uuid.Parse(includeID); err == nil {
			if e = addUser(includeID); e != nil {
				return nil, e
			}
		}
	}
	rankDocs, e := h.App.Store.ListDocuments(r.ctx, "ranking.v2")
	if e != nil {
		return nil, e
	}
	global := []map[string]any{}
	friendsRank := []map[string]any{}
	seenRank := map[string]bool{}
	for _, d := range rankDocs {
		var u map[string]any
		if e = json.Unmarshal(d.Data, &u); e != nil {
			return nil, e
		}
		id, _ := u["id"].(string)
		if id == "" {
			continue
		}
		if !p.Open.Enabled && id != r.userID && !contains(locIDs, id) {
			continue
		}
		b, e := t.blocked(r.userID, id)
		if e != nil {
			return nil, e
		}
		if b {
			continue
		}
		if current, ok := users[id].(map[string]any); ok {
			u = current
		}
		seenRank[id] = true
		global = append(global, u)
		if id == r.userID || contains(locIDs, id) {
			friendsRank = append(friendsRank, u)
		}
	}
	if !seenRank[r.userID] {
		self := users[r.userID].(map[string]any)
		global = append(global, self)
		friendsRank = append(friendsRank, self)
	}
	rank := func(list []map[string]any) []map[string]any {
		score := func(v any) float64 {
			switch n := v.(type) {
			case int:
				return float64(n)
			case float64:
				return n
			}
			return 0
		}
		sort.Slice(list, func(i, j int) bool {
			a, b := score(list[i]["totalXp"]), score(list[j]["totalXp"])
			if a == b {
				return list[i]["id"].(string) < list[j]["id"].(string)
			}
			return a > b
		})
		out := []map[string]any{}
		for i, u := range list {
			copy := map[string]any{}
			for k, v := range u {
				copy[k] = v
			}
			copy["rank"] = i + 1
			copy["mine"] = u["id"] == r.userID
			if i < 100 || copy["mine"] == true {
				out = append(out, copy)
			}
		}
		return out
	}
	global = rank(global)
	friendsRank = rank(friendsRank)
	if !p.Open.Enabled {
		global = []map[string]any{}
	}
	badges := []map[string]any{{"id": "primer-jale", "label": "Primer jale", "icon": "star", "tile": "bg-cat-comer", "earned": p.Hangouts > 0}, {"id": "anfitrion", "label": "Anfitrión", "icon": "users", "tile": "bg-cat-otro", "earned": p.Events >= 3}, {"id": "racha-10", "label": "Racha 10", "icon": "flame", "tile": "bg-cat-musica", "earned": streak(p.History) >= 10}}
	sort.Slice(plans, func(i, j int) bool { return plans[i].Starts < plans[j].Starts })
	sort.Slice(events, func(i, j int) bool { return events[i].Starts < events[j].Starts })
	return map[string]any{"session": map[string]string{"email": me.Email, "userId": me.UserID}, "location": map[string]any{"status": p.Location.Status, "center": center}, "ghost": me.GhostMode, "openMode": p.Open, "xp": p.XP, "xpGoal": 500, "users": users, "friendships": friendships, "plans": plans, "events": events, "matches": matches, "swipes": p.Swipes, "radiusM": p.Radius, "visibilityRadiusM": p.Visibility, "invites": invites, "exactShares": shares, "exactGrants": grants, "exactPending": exactPending, "exactRequests": incomingExact, "exactLocations": exactLocations, "presence": presence, "friendDistances": distances, "pastPlans": pastPlans, "canceledPlans": canceled, "history": myHistory, "attendances": attendances, "attendees": attendees, "pendingAttendees": pendingAttendees, "xpEvents": p.Rewards, "record": recordOrEmpty(p.Record), "blocks": p.Blocks, "reports": []any{}, "badges": badges, "dayOffset": 0, "eventDraft": p.Draft, "rankings": map[string]any{"global": global, "amigos": friendsRank}}, nil
}

// pastPlanFor: un plan terminado hace menos de `historyDays`, solo para quien fue (o lo organizó). Sin distancias ni ubicaciones.
func (t *socialTx) pastPlanFor(me string, plan socialPlan, addUser func(string) error) (socialPlan, bool, error) {
	if plan.Author != me && plan.Members[me].Status != "going" {
		return plan, false, nil
	}
	if time.Since(instant(plan.Expires)) > historyDays*24*time.Hour {
		return plan, false, nil
	}
	if e := addUser(plan.Author); e != nil {
		return plan, false, e
	}
	plan.MemberIDs = []string{}
	plan.Roster = nil
	for uid, m := range plan.Members {
		if m.Status != "going" && uid != plan.Author {
			continue
		}
		b, e := t.blocked(me, uid)
		if e != nil {
			return plan, false, e
		}
		if b {
			continue
		}
		if e = addUser(uid); e != nil {
			return plan, false, e
		}
		plan.MemberIDs = append(plan.MemberIDs, uid)
		plan.Roster = append(plan.Roster, rosterEntry{UserID: uid, Organizer: uid == plan.Author, ArrivedAt: m.Verified, ConfirmedBy: m.ConfirmedBy, JoinedAt: m.Joined})
	}
	plan.Photo = t.mediaURL(plan.PhotoKey)
	plan.Members = nil
	return plan, true, nil
}

// canceledEntry: una fila del historial de cancelados (últimos 30 días). `kind`: "canceled" (se canceló el plan; `byMe` si lo
// organizabas) o "left" (saliste tú). `at` es cuándo; con `startsAt` el cliente calcula "con N min de anticipación".
func canceledEntry(me string, plan socialPlan) (map[string]any, bool) {
	mem := plan.Members[me]
	var at, kind string
	switch {
	case plan.Canceled && (plan.Author == me || mem.Status == "going" || mem.Status == "left"):
		kind, at = "canceled", plan.CanceledAt
	case !plan.Canceled && mem.Status == "left":
		kind, at = "left", mem.LeftAt
	default:
		return nil, false
	}
	if at == "" {
		at = plan.Starts
	}
	if time.Since(instant(at)) > historyDays*24*time.Hour {
		return nil, false
	}
	return map[string]any{"id": plan.ID, "kind": kind, "line": plan.Line, "category": plan.Category, "placeName": plan.Place.Name, "startsAt": plan.Starts, "at": at, "organizerId": plan.Author, "byMe": plan.Author == me}, true
}

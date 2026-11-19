package api_test

import (
	"context"
	"testing"

	"github.com/redis/go-redis/v9"
)

// G6: check-in con geocerca, confirmación por otro integrante, mensajes rápidos y penalizaciones.
func TestPlanLifecycleCheckInMessagesAndPenalties(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, _ := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	pid := publish(c, a) // empieza hace 1 min
	action(c, b, map[string]any{"type": "jalo", "id": pid})

	// Lejos del lugar no hay check-in; cerca sí (250 m), y da XP una sola vez.
	rejected(c, b, map[string]any{"type": "checkIn", "id": pid, "center": map[string]any{"lat": 19.44, "lng": -99.134}}, 400)
	action(c, b, map[string]any{"type": "checkIn", "id": pid, "center": map[string]any{"lat": 19.4341, "lng": -99.134}, "accuracy": 20})
	xp := state(c, b)["xp"].(float64)
	if xp <= 0 {
		t.Fatal("check-in did not reward")
	}
	action(c, b, map[string]any{"type": "checkIn", "id": pid, "center": map[string]any{"lat": 19.4341, "lng": -99.134}})
	if state(c, b)["xp"].(float64) != xp {
		t.Fatal("check-in rewarded twice")
	}
	if rec := state(c, b)["record"].([]any); len(rec) != 1 || rec[0] != "ok" {
		t.Fatalf("record = %v", rec)
	}

	// Quien ya llegó confirma a quien no puede por GPS; quien no llegó no puede confirmar a nadie.
	rejected(c, a, map[string]any{"type": "confirmArrival", "id": pid, "userId": aid}, 400)
	bid := ""
	for _, e := range state(c, a)["plans"].([]any)[0].(map[string]any)["roster"].([]any) {
		if r := e.(map[string]any); r["organizer"] == false {
			bid = r["userId"].(string)
		}
	}
	// Quien organiza sí puede confirmar a otro aunque él no haya llegado (idempotente si ya llegó).
	action(c, a, map[string]any{"type": "confirmArrival", "id": pid, "userId": bid})
	action(c, b, map[string]any{"type": "confirmArrival", "id": pid, "userId": aid})
	if state(c, a)["xp"].(float64) <= 0 {
		t.Fatal("confirmed arrival did not reward")
	}

	// Chat: texto libre (los rápidos son atajos) y enfriamiento de 2 s entre mensajes.
	rejected(c, b, map[string]any{"type": "planMessage", "id": pid, "message": ""}, 400)
	action(c, b, map[string]any{"type": "planMessage", "id": pid, "message": "Ya estoy aquí"})
	rejected(c, b, map[string]any{"type": "planMessage", "id": pid, "message": "Voy tarde"}, 400)
	if tl := state(c, a)["plans"].([]any)[0].(map[string]any)["timeline"].([]any); len(tl) != 1 {
		t.Fatalf("timeline = %v", tl)
	}
}

func TestCancellationPenaltyAndFloor(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, _ := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	pid := publish(c, a)
	action(c, b, map[string]any{"type": "jalo", "id": pid})
	// Ya empezado (cancelación tardía): −60 XP, nunca por debajo de 0, y cuenta como falla.
	action(c, b, map[string]any{"type": "leavePlan", "id": pid})
	s := state(c, b)
	if s["xp"].(float64) != 0 {
		t.Fatalf("xp = %v", s["xp"])
	}
	if rec := s["record"].([]any); len(rec) != 1 || rec[0] != "miss" {
		t.Fatalf("record = %v", rec)
	}
}

func TestFriendDistanceOnlyRoundedNeverOnMap(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	locate(c, aid, 19.432)
	locate(c, bid, 19.4375) // ~600 m al norte; amigos NO cercanos
	s := state(c, a)
	ds := s["friendDistances"].([]any)
	if len(ds) != 1 {
		t.Fatalf("friendDistances = %v", ds)
	}
	d := ds[0].(map[string]any)["distanceM"].(float64)
	if int(d)%100 != 0 || d < 100 {
		t.Fatalf("distance not rounded: %v", d)
	}
	if len(s["presence"].([]any)) != 0 {
		t.Fatal("non-close friend leaked onto the map")
	}
}

func TestLastKnownDistanceSurvivesLiveExpiry(t *testing.T) {
	c := newClient(t)
	a, aid := c.register("alice")
	b, bid := c.register("bob")
	setZone(c, a)
	setZone(c, b)
	makeFriends(c, a, b, aid)
	locate(c, aid, 19.432)
	locate(c, bid, 19.4375)
	// Caduca la ubicación EN VIVO de bob (TTL de 2 min): su última ubicación guardada sigue disponible.
	rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
	defer rdb.Close()
	if err := rdb.Del(context.Background(), "loc:"+bid).Err(); err != nil {
		t.Fatal(err)
	}
	if ds := state(c, a)["friendDistances"].([]any); len(ds) != 1 {
		t.Fatalf("last known location lost after live expiry: %v", ds)
	}
}

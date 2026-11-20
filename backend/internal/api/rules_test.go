package api

import (
	"testing"
)

func TestOthersArrivedCoversTheHost(t *testing.T) {
	plan := socialPlan{Author: "host", Members: map[string]member{
		"host": {Status: "going"},
		"a":    {Status: "going"},
		"b":    {Status: "left", Verified: "2026-01-01T00:00:00Z"},
	}}
	if othersArrived(plan, "host") {
		t.Fatal("nobody verified yet (a left member does not count)")
	}
	plan.Members["a"] = member{Status: "going", Verified: "2026-01-01T00:00:00Z"}
	if !othersArrived(plan, "host") {
		t.Fatal("a verified guest means the plan happened")
	}
}

func TestLevelsNeedFewerXP(t *testing.T) {
	p := personal{Level: 1}
	for i := 0; i < 3; i++ {
		reward(&p, 60, "x", string(rune('a'+i)))
	}
	if p.Level != 2 || p.XP != 30 {
		t.Fatalf("level=%d xp=%d (180 XP = nivel 2 con 30 de sobra)", p.Level, p.XP)
	}
}

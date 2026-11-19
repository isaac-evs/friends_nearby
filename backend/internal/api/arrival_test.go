package api

import (
	"testing"
	"time"
)

func TestArrivalXPTiers(t *testing.T) {
	start := time.Date(2026, 11, 19, 18, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		offset time.Duration
		xp     int
		label  string
	}{
		{-10 * time.Minute, 30, "temprano"},
		{-5 * time.Minute, 30, "temprano"},
		{-4 * time.Minute, 20, "a tiempo"},
		{5 * time.Minute, 20, "a tiempo"},
		{6 * time.Minute, 12, "tarde"},
		{15 * time.Minute, 12, "tarde"},
		{16 * time.Minute, 8, "tarde"},
		{30 * time.Minute, 8, "tarde"},
		{31 * time.Minute, 5, "muy tarde"},
	} {
		if xp, label := arrivalXP(start, start.Add(tc.offset)); xp != tc.xp || label != tc.label {
			t.Errorf("offset %v: got %d %s, want %d %s", tc.offset, xp, label, tc.xp, tc.label)
		}
	}
}

func TestJoiningInProgressIsNeverLate(t *testing.T) {
	start := time.Date(2026, 11, 19, 18, 0, 0, 0, time.UTC)
	plan := socialPlan{Starts: start.Format(time.RFC3339Nano)}
	at := func(min int) member {
		return member{Joined: start.Add(time.Duration(min) * time.Minute).Format(time.RFC3339Nano)}
	}

	// Se unió antes (o en el primer minuto de un plan "ahora"): se espera desde el inicio y sí puede llegar tarde.
	for _, m := range []member{at(-60), at(0), at(1)} {
		if joinedInProgress(plan, m) {
			t.Fatalf("early joiner flagged as in progress: %+v", m)
		}
	}
	if !dueAt(plan, at(-60)).Equal(start) {
		t.Fatal("early joiner is due at the start")
	}
	// Se unió con el plan ya iniciado: no está obligado, y se espera desde que se unió.
	late := at(20)
	if !joinedInProgress(plan, late) {
		t.Fatal("in-progress joiner must be exempt")
	}
	if got := dueAt(plan, late); !got.Equal(start.Add(20 * time.Minute)) {
		t.Fatalf("due = %v", got)
	}
	// Llegar 3 min después de unirse es "a tiempo", no tarde.
	if xp, label := arrivalXP(dueAt(plan, late), start.Add(23*time.Minute)); xp != 20 || label != "a tiempo" {
		t.Fatalf("got %d %s", xp, label)
	}
}

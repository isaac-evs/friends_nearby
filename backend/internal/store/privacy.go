package store

import (
	"context"
	"encoding/json"
	"time"
)

// LocationPolicy lives in the social profile. Missing consent always denies
// access, including accounts created before the close-friends model existed.
type LocationPolicy struct {
	Close        map[string]string `json:"close"`
	Exact        map[string]string `json:"exactShares"`
	Radius       int               `json:"visibilityRadiusM"`
	SearchRadius int               `json:"radiusM"`
	ExactEpoch   int               `json:"exactEpoch"`
	GrantEpoch   map[string]int    `json:"grantEpoch"`
}

func (s *Store) LocationPolicy(ctx context.Context, id string) (LocationPolicy, error) {
	p := LocationPolicy{Radius: 3000, SearchRadius: 5000}
	d, e := s.GetDocument(ctx, "user#"+id, "profile")
	if e != nil {
		return p, e
	}
	if len(d.Data) > 0 {
		e = json.Unmarshal(d.Data, &p)
	}
	return p, e
}
func (s *Store) CanSeeLocation(ctx context.Context, viewer, subject string) (bool, error) {
	blocked, e := s.IsBlocked(ctx, viewer, subject)
	if e != nil || blocked {
		return false, e
	}
	f, e := s.GetFriendship(ctx, viewer, subject)
	if e != nil || f == nil || f.Status != "accepted" {
		return false, e
	}
	a, e := s.LocationPolicy(ctx, viewer)
	if e != nil {
		return false, e
	}
	b, e := s.LocationPolicy(ctx, subject)
	return a.Close[subject] == "mutual" && b.Close[viewer] == "mutual", e
}
func (s *Store) HasExactAudience(ctx context.Context, id string) (bool, error) {
	p, e := s.LocationPolicy(ctx, id)
	if e != nil {
		return false, e
	}
	for other, until := range p.Exact {
		end, e := time.Parse(time.RFC3339Nano, until)
		if e != nil || !end.After(time.Now()) {
			continue
		}
		ok, e := s.CanSeeLocation(ctx, other, id)
		if e != nil {
			return false, e
		}
		viewer, e := s.LocationPolicy(ctx, other)
		if e != nil {
			return false, e
		}
		if ok && p.GrantEpoch[other] == viewer.ExactEpoch {
			return ok, e
		}
	}
	return false, nil
}

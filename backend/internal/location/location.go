// Package location keeps real-time state in Redis.
//
// Keys:
//
//	loc:{user_id}   JSON models.Location, expires after LOCATION_TTL_SECONDS
//	near:{viewer}   set of friend ids currently inside viewer's radius,
//	                with the same TTL; used to detect enter/leave transitions
package location

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"math"
	"net"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/isaac-evs/friends_nearby/backend/internal/config"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
)

type Store struct {
	rdb *redis.Client
	ttl time.Duration
}

func NewClient(cfg *config.Config) *redis.Client {
	opts := &redis.Options{Addr: net.JoinHostPort(cfg.RedisHost, cfg.RedisPort)}
	if cfg.RedisTLS {
		opts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12, ServerName: cfg.RedisHost}
	}
	return redis.NewClient(opts)
}

func New(rdb *redis.Client, ttl time.Duration) *Store {
	return &Store{rdb: rdb, ttl: ttl}
}

func locKey(id string) string  { return "loc:" + id }
func nearKey(id string) string { return "near:" + id }

func (s *Store) Set(ctx context.Context, userID string, loc models.Location) error {
	b, err := json.Marshal(loc)
	if err != nil {
		return err
	}
	return s.rdb.Set(ctx, locKey(userID), b, s.ttl).Err()
}

// Exact coordinates are a separate, short-lived value, written only while an
// explicit sharing grant exists. They never enter DynamoDB, SQS or history.
func (s *Store) SetExact(ctx context.Context, id string, loc models.Location) error {
	b, e := json.Marshal(loc)
	if e != nil {
		return e
	}
	return s.rdb.Set(ctx, "exact:"+id, b, s.ttl).Err()
}
func (s *Store) GetExact(ctx context.Context, id string) (*models.Location, error) {
	b, e := s.rdb.Get(ctx, "exact:"+id).Bytes()
	if errors.Is(e, redis.Nil) {
		return nil, nil
	}
	if e != nil {
		return nil, e
	}
	var loc models.Location
	e = json.Unmarshal(b, &loc)
	return &loc, e
}
func (s *Store) DeleteExact(ctx context.Context, id string) error {
	return s.rdb.Del(ctx, "exact:"+id).Err()
}

// Get returns nil when the user has no live location.
func (s *Store) Get(ctx context.Context, userID string) (*models.Location, error) {
	b, err := s.rdb.Get(ctx, locKey(userID)).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var loc models.Location
	if err := json.Unmarshal(b, &loc); err != nil {
		return nil, err
	}
	return &loc, nil
}

// GetMany returns the live locations of the given users, keyed by id.
func (s *Store) GetMany(ctx context.Context, userIDs []string) (map[string]models.Location, error) {
	result := make(map[string]models.Location, len(userIDs))
	if len(userIDs) == 0 {
		return result, nil
	}
	keys := make([]string, len(userIDs))
	for i, id := range userIDs {
		keys[i] = locKey(id)
	}
	values, err := s.rdb.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}
	for i, v := range values {
		str, ok := v.(string)
		if !ok {
			continue
		}
		var loc models.Location
		if json.Unmarshal([]byte(str), &loc) == nil {
			result[userIDs[i]] = loc
		}
	}
	return result, nil
}

func (s *Store) Delete(ctx context.Context, userID string) error {
	return s.rdb.Del(ctx, locKey(userID), "exact:"+userID).Err()
}

// IsNear reports whether friend is in viewer's near set.
func (s *Store) IsNear(ctx context.Context, viewer, friend string) (bool, error) {
	return s.rdb.SIsMember(ctx, nearKey(viewer), friend).Result()
}

func (s *Store) AddNear(ctx context.Context, viewer, friend string) error {
	pipe := s.rdb.TxPipeline()
	pipe.SAdd(ctx, nearKey(viewer), friend)
	pipe.Expire(ctx, nearKey(viewer), s.ttl)
	_, err := pipe.Exec(ctx)
	return err
}

func (s *Store) RemoveNear(ctx context.Context, viewer, friend string) error {
	return s.rdb.SRem(ctx, nearKey(viewer), friend).Err()
}

func (s *Store) NearIDs(ctx context.Context, viewer string) ([]string, error) {
	return s.rdb.SMembers(ctx, nearKey(viewer)).Result()
}

func (s *Store) DeleteNear(ctx context.Context, viewer string) error {
	return s.rdb.Del(ctx, nearKey(viewer)).Err()
}

// DistanceM is the great-circle distance in meters (haversine).
func DistanceM(a, b models.Location) float64 {
	const earthRadiusM = 6371000.0
	rad := math.Pi / 180
	dLat := (b.Lat - a.Lat) * rad
	dLng := (b.Lng - a.Lng) * rad
	h := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(a.Lat*rad)*math.Cos(b.Lat*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusM * math.Asin(math.Min(1, math.Sqrt(h)))
}

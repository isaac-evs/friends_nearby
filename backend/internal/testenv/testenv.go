// Package testenv builds an App wired to DynamoDB Local and Redis (see
// docker-compose.yml) with fake WebSocket push, queue and presigner. Tests that
// use it are skipped automatically when the services are not running.
package testenv

import (
	"context"
	"encoding/json"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"

	"github.com/isaac-evs/friends_nearby/backend/internal/api"
	"github.com/isaac-evs/friends_nearby/backend/internal/app"
	"github.com/isaac-evs/friends_nearby/backend/internal/auth"
	"github.com/isaac-evs/friends_nearby/backend/internal/config"
	"github.com/isaac-evs/friends_nearby/backend/internal/location"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/ports"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

const (
	dynamoAddr = "localhost:8000"
	redisAddr  = "localhost:6379"
)

// Origin used by the tests; the offsets below are in degrees of latitude.
const (
	BaseLat = 19.4326
	BaseLng = -99.1332
)

// Meters converts a north-south distance in meters to degrees of latitude.
func Meters(m float64) float64 { return m / 111195.0 }

type Env struct {
	App     *app.App
	Handler *api.Handler
	Store   *store.Store
	Pusher  *FakePusher
	Queue   *FakeQueue
}

func New(t *testing.T) *Env {
	t.Helper()
	for _, addr := range []string{dynamoAddr, redisAddr} {
		c, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
		if err != nil {
			t.Skipf("%s not reachable (run `docker compose up -d` in backend/): %v", addr, err)
		}
		_ = c.Close()
	}

	t.Setenv("AWS_REGION", "us-east-1")
	t.Setenv("AWS_ACCESS_KEY_ID", "local")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "local")
	id := uuid.NewString()[:8]
	cfg := &config.Config{
		UsersTable:       "t-" + id + "-users",
		FriendshipsTable: "t-" + id + "-friendships",
		ConnectionsTable: "t-" + id + "-connections",
		RedisHost:        "localhost",
		RedisPort:        "6379",
		LocationTTL:      120 * time.Second,
		CDNDomain:        "cdn.test",
		JWTSecret:        "test-secret-test-secret-test-secret",
		JWTTTL:           time.Hour,
		DynamoEndpoint:   "http://" + dynamoAddr,
	}

	ctx := context.Background()
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		t.Fatal(err)
	}
	db := dynamodb.NewFromConfig(awsCfg, func(o *dynamodb.Options) { o.BaseEndpoint = aws.String(cfg.DynamoEndpoint) })
	if err := store.EnsureTables(ctx, db, cfg); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		for _, name := range []string{cfg.UsersTable, cfg.FriendshipsTable, cfg.ConnectionsTable, store.New(db, cfg).SocialTable()} {
			_, _ = db.DeleteTable(context.Background(), &dynamodb.DeleteTableInput{TableName: aws.String(name)})
		}
	})

	rdb := location.NewClient(cfg)
	t.Cleanup(func() { _ = rdb.Close() })

	e := &Env{Pusher: &FakePusher{msgs: map[string][]app.Message{}}, Queue: &FakeQueue{}}
	e.Store = store.New(db, cfg)
	e.App = &app.App{
		Cfg:       cfg,
		Auth:      auth.New(cfg.JWTSecret, cfg.JWTTTL),
		Store:     e.Store,
		Loc:       location.New(rdb, cfg.LocationTTL),
		Pusher:    e.Pusher,
		Queue:     e.Queue,
		Presigner: fakePresigner{},
	}
	e.Handler = &api.Handler{App: e.App}
	return e
}

// User is a test user with one open (fake) WebSocket connection.
type User struct {
	*models.User
	ConnID string
}

// AddUser creates a user and gives them one live connection.
func (e *Env) AddUser(t *testing.T, name string) *User {
	t.Helper()
	ctx := context.Background()
	u := &models.User{
		UserID:      uuid.NewString(),
		Email:       name + "@example.com",
		Username:    name,
		DisplayName: name,
		RadiusM:     config.DefaultRadiusM,
		CreatedAt:   time.Now().Unix(),
	}
	if err := e.Store.CreateUser(ctx, u); err != nil {
		t.Fatalf("create user %s: %v", name, err)
	}
	conn := uuid.NewString()
	if err := e.Store.PutConnection(ctx, conn, u.UserID); err != nil {
		t.Fatal(err)
	}
	return &User{User: u, ConnID: conn}
}

// Befriend makes a and b accepted friends.
func (e *Env) Befriend(t *testing.T, a, b *User) {
	t.Helper()
	ctx := context.Background()
	if err := e.Store.CreateRequest(ctx, a.UserID, b.UserID); err != nil {
		t.Fatal(err)
	}
	if err := e.Store.Accept(ctx, b.UserID, a.UserID); err != nil {
		t.Fatal(err)
	}
}

// Move sends a location update for u (as the WebSocket handler would).
func (e *Env) Move(u *User, lat, lng float64) error {
	return e.App.HandleLocation(context.Background(), u.UserID, models.Location{Lat: lat, Lng: lng})
}

// Types returns the message types u has received, in order.
func (e *Env) Types(u *User) []string {
	var out []string
	for _, m := range e.Pusher.Messages(u.ConnID) {
		out = append(out, m.Type)
	}
	return out
}

// ---------------------------------------------------------------- fakes

type FakePusher struct {
	mu   sync.Mutex
	msgs map[string][]app.Message
	gone map[string]bool
}

// MarkGone makes pushes to connectionID fail with ports.ErrGone, like a closed socket.
func (p *FakePusher) MarkGone(connectionID string) {
	p.mu.Lock()
	if p.gone == nil {
		p.gone = map[string]bool{}
	}
	p.gone[connectionID] = true
	p.mu.Unlock()
}

func (p *FakePusher) Push(_ context.Context, connectionID string, payload []byte) error {
	p.mu.Lock()
	isGone := p.gone[connectionID]
	p.mu.Unlock()
	if isGone {
		return ports.ErrGone
	}
	var m app.Message
	if err := json.Unmarshal(payload, &m); err != nil {
		return err
	}
	p.mu.Lock()
	p.msgs[connectionID] = append(p.msgs[connectionID], m)
	p.mu.Unlock()
	return nil
}

func (p *FakePusher) Messages(connectionID string) []app.Message {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]app.Message(nil), p.msgs[connectionID]...)
}

func (p *FakePusher) Reset() {
	p.mu.Lock()
	p.msgs = map[string][]app.Message{}
	p.mu.Unlock()
}

type FakeQueue struct {
	mu     sync.Mutex
	Bodies [][]byte
}

func (q *FakeQueue) Send(_ context.Context, body []byte) error {
	q.mu.Lock()
	q.Bodies = append(q.Bodies, body)
	q.mu.Unlock()
	return nil
}

func (q *FakeQueue) Count() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.Bodies)
}

type fakePresigner struct{}

func (fakePresigner) PresignPut(_ context.Context, key, _ string, _ time.Duration) (string, error) {
	return "https://example.invalid/" + key, nil
}

var (
	_ ports.Pusher    = (*FakePusher)(nil)
	_ ports.Queue     = (*FakeQueue)(nil)
	_ ports.Presigner = fakePresigner{}
)

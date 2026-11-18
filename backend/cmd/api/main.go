// Command api is the main Lambda (HTTP API + WebSocket API).
// Build for AWS: GOOS=linux GOARCH=amd64 go build -tags lambda.norpc -o bootstrap ./cmd/api
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"github.com/isaac-evs/friends_nearby/backend/internal/api"
	"github.com/isaac-evs/friends_nearby/backend/internal/app"
	"github.com/isaac-evs/friends_nearby/backend/internal/auth"
	"github.com/isaac-evs/friends_nearby/backend/internal/awsadapters"
	"github.com/isaac-evs/friends_nearby/backend/internal/config"
	"github.com/isaac-evs/friends_nearby/backend/internal/location"
	"github.com/isaac-evs/friends_nearby/backend/internal/store"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	ctx := context.Background()

	cfg, err := config.Load(
		"USERS_TABLE", "FRIENDSHIPS_TABLE", "CONNECTIONS_TABLE", "REDIS_HOST",
		"EVENTS_QUEUE_URL", "MEDIA_BUCKET", "CDN_DOMAIN", "WS_MANAGEMENT_URL", "JWT_SECRET",
	)
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		slog.Error("aws config", "err", err)
		os.Exit(1)
	}

	s3 := awsadapters.NewS3(awsCfg, cfg.MediaBucket, "")
	h := &api.Handler{App: &app.App{
		Cfg:       cfg,
		Auth:      auth.New(cfg.JWTSecret, cfg.JWTTTL),
		Store:     store.New(dynamodb.NewFromConfig(awsCfg), cfg),
		Loc:       location.New(location.NewClient(cfg), cfg.LocationTTL),
		Pusher:    awsadapters.NewWSPusher(awsCfg, cfg.WSManagementURL),
		Queue:     awsadapters.NewSQSQueue(awsCfg, cfg.EventsQueueURL),
		Presigner: s3,
	}}
	lambda.Start(h.Handle)
}

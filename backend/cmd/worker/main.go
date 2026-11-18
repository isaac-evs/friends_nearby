// Command worker is the SQS-triggered Lambda that writes history batches to S3.
// Build for AWS: GOOS=linux GOARCH=amd64 go build -tags lambda.norpc -o bootstrap ./cmd/worker
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"

	"github.com/isaac-evs/friends_nearby/backend/internal/awsadapters"
	"github.com/isaac-evs/friends_nearby/backend/internal/config"
	"github.com/isaac-evs/friends_nearby/backend/internal/worker"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	cfg, err := config.Load("HISTORY_BUCKET")
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background())
	if err != nil {
		slog.Error("aws config", "err", err)
		os.Exit(1)
	}
	h := &worker.Handler{Sink: awsadapters.NewS3(awsCfg, "", cfg.HistoryBucket)}
	lambda.Start(h.Handle)
}

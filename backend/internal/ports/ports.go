// Package ports defines the small interfaces that differ between AWS and the
// local runner (WebSocket push, SQS, S3).
package ports

import (
	"context"
	"errors"
	"time"
)

// ErrGone means the WebSocket connection no longer exists.
var ErrGone = errors.New("connection gone")

type Mailer interface {
	SendReset(ctx context.Context, email, link string) error
}

// Pusher sends a message to one WebSocket connection.
// In AWS it calls API Gateway's postToConnection; locally it writes to a socket.
type Pusher interface {
	Push(ctx context.Context, connectionID string, payload []byte) error
}

// Queue publishes history events. In AWS this is SQS.
type Queue interface {
	Send(ctx context.Context, body []byte) error
}

// Presigner creates a presigned S3 PUT URL for the media bucket.
type Presigner interface {
	PresignPut(ctx context.Context, key, contentType string, expires time.Duration) (string, error)
}

// HistorySink stores one batch of history events (JSON lines). In AWS this is S3.
type HistorySink interface {
	Put(ctx context.Context, key string, body []byte) error
}

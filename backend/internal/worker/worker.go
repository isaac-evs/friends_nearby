// Package worker batches SQS history events into one S3 object per invocation.
package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/google/uuid"

	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"github.com/isaac-evs/friends_nearby/backend/internal/ports"
)

type Handler struct {
	Sink ports.HistorySink
	Now  func() time.Time // injectable for local runs; defaults to time.Now
}

// Handle returns partial-batch failures, matching the event source mapping's
// ReportBatchItemFailures setting. Malformed messages are reported as failed so
// they end up in the dead-letter queue instead of being silently dropped.
func (h *Handler) Handle(ctx context.Context, ev events.SQSEvent) (events.SQSEventResponse, error) {
	var buf bytes.Buffer
	var good []string
	var failures []events.SQSBatchItemFailure

	for _, rec := range ev.Records {
		var e models.HistoryEvent
		if err := json.Unmarshal([]byte(rec.Body), &e); err != nil || e.UserID == "" {
			slog.Error("invalid history event", "message", rec.MessageId, "err", err)
			failures = append(failures, events.SQSBatchItemFailure{ItemIdentifier: rec.MessageId})
			continue
		}
		buf.WriteString(rec.Body)
		buf.WriteByte('\n')
		good = append(good, rec.MessageId)
	}
	if len(good) == 0 {
		return events.SQSEventResponse{BatchItemFailures: failures}, nil
	}

	now := time.Now
	if h.Now != nil {
		now = h.Now
	}
	t := now().UTC()
	key := fmt.Sprintf("history/%04d/%02d/%02d/%02d/%s.jsonl", t.Year(), t.Month(), t.Day(), t.Hour(), uuid.NewString())
	if err := h.Sink.Put(ctx, key, buf.Bytes()); err != nil {
		slog.Error("write history batch", "key", key, "err", err)
		for _, id := range good {
			failures = append(failures, events.SQSBatchItemFailure{ItemIdentifier: id})
		}
	}
	return events.SQSEventResponse{BatchItemFailures: failures}, nil
}

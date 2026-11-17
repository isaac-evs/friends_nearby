package worker

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"
)

type fakeSink struct {
	keys   []string
	bodies []string
	err    error
}

func (f *fakeSink) Put(_ context.Context, key string, body []byte) error {
	if f.err != nil {
		return f.err
	}
	f.keys = append(f.keys, key)
	f.bodies = append(f.bodies, string(body))
	return nil
}

func msg(id, body string) events.SQSMessage { return events.SQSMessage{MessageId: id, Body: body} }

const (
	evA = `{"type":"location","user_id":"u1","lat":1,"lng":2,"ts":1}`
	evB = `{"type":"location","user_id":"u2","lat":3,"lng":4,"ts":2}`
)

func newHandler(sink *fakeSink) *Handler {
	fixed := time.Date(2026, 3, 9, 14, 5, 0, 0, time.UTC)
	return &Handler{Sink: sink, Now: func() time.Time { return fixed }}
}

func ids(r events.SQSEventResponse) []string {
	var out []string
	for _, f := range r.BatchItemFailures {
		out = append(out, f.ItemIdentifier)
	}
	return out
}

func TestBatchIsWrittenAsOneObject(t *testing.T) {
	sink := &fakeSink{}
	resp, err := newHandler(sink).Handle(context.Background(), events.SQSEvent{Records: []events.SQSMessage{msg("1", evA), msg("2", evB)}})
	if err != nil || len(resp.BatchItemFailures) != 0 {
		t.Fatalf("resp = %+v, err = %v", resp, err)
	}
	if len(sink.keys) != 1 {
		t.Fatalf("objects written = %d, want 1", len(sink.keys))
	}
	if !strings.HasPrefix(sink.keys[0], "history/2026/03/09/14/") || !strings.HasSuffix(sink.keys[0], ".jsonl") {
		t.Errorf("unexpected key %q", sink.keys[0])
	}
	if sink.bodies[0] != evA+"\n"+evB+"\n" {
		t.Errorf("unexpected body %q", sink.bodies[0])
	}
}

func TestMalformedMessagesAreReportedAndGoodOnesStillWritten(t *testing.T) {
	sink := &fakeSink{}
	batch := events.SQSEvent{Records: []events.SQSMessage{
		msg("ok-1", evA),
		msg("bad-json", `{not json`),
		msg("no-user", `{"type":"location","lat":1}`),
		msg("ok-2", evB),
	}}
	resp, _ := newHandler(sink).Handle(context.Background(), batch)

	got := strings.Join(ids(resp), ",")
	if got != "bad-json,no-user" {
		t.Errorf("failures = %q, want bad-json,no-user", got)
	}
	if len(sink.bodies) != 1 || sink.bodies[0] != evA+"\n"+evB+"\n" {
		t.Errorf("good messages should still be written: %q", sink.bodies)
	}
}

func TestSinkFailureFailsOnlyTheMessagesInTheBatch(t *testing.T) {
	sink := &fakeSink{err: errors.New("s3 down")}
	batch := events.SQSEvent{Records: []events.SQSMessage{msg("1", evA), msg("bad", "x"), msg("2", evB)}}
	resp, err := newHandler(sink).Handle(context.Background(), batch)
	if err != nil {
		t.Fatalf("handler must report failures, not return an error: %v", err)
	}
	if got := strings.Join(ids(resp), ","); got != "bad,1,2" {
		t.Errorf("failures = %q, want bad,1,2", got)
	}
}

func TestEmptyAndAllBadBatchesWriteNothing(t *testing.T) {
	sink := &fakeSink{}
	h := newHandler(sink)
	if resp, err := h.Handle(context.Background(), events.SQSEvent{}); err != nil || len(resp.BatchItemFailures) != 0 {
		t.Errorf("empty batch: %+v, %v", resp, err)
	}
	resp, _ := h.Handle(context.Background(), events.SQSEvent{Records: []events.SQSMessage{msg("x", "nope")}})
	if len(resp.BatchItemFailures) != 1 || len(sink.keys) != 0 {
		t.Errorf("all-bad batch: failures=%v, writes=%d", ids(resp), len(sink.keys))
	}
}

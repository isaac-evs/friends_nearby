// Package awsadapters implements internal/ports against real AWS services.
package awsadapters

import (
	"bytes"
	"context"
	"errors"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/apigatewaymanagementapi"
	apigwtypes "github.com/aws/aws-sdk-go-v2/service/apigatewaymanagementapi/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sqs"

	"github.com/isaac-evs/friends_nearby/backend/internal/ports"
)

// ---- WebSocket push

type WSPusher struct {
	client *apigatewaymanagementapi.Client
}

func NewWSPusher(cfg aws.Config, managementURL string) *WSPusher {
	return &WSPusher{client: apigatewaymanagementapi.NewFromConfig(cfg, func(o *apigatewaymanagementapi.Options) {
		o.BaseEndpoint = aws.String(managementURL)
	})}
}

func (p *WSPusher) Push(ctx context.Context, connectionID string, payload []byte) error {
	_, err := p.client.PostToConnection(ctx, &apigatewaymanagementapi.PostToConnectionInput{
		ConnectionId: aws.String(connectionID),
		Data:         payload,
	})
	var gone *apigwtypes.GoneException
	if errors.As(err, &gone) {
		return ports.ErrGone
	}
	return err
}

// ---- SQS

type SQSQueue struct {
	client *sqs.Client
	url    string
}

func NewSQSQueue(cfg aws.Config, url string) *SQSQueue {
	return &SQSQueue{client: sqs.NewFromConfig(cfg), url: url}
}

func (q *SQSQueue) Send(ctx context.Context, body []byte) error {
	_, err := q.client.SendMessage(ctx, &sqs.SendMessageInput{
		QueueUrl:    aws.String(q.url),
		MessageBody: aws.String(string(body)),
	})
	return err
}

// ---- S3

type S3 struct {
	client  *s3.Client
	presign *s3.PresignClient
	media   string
	history string
}

// NewS3 builds the S3 adapter. A non-empty endpoint (S3Mock in docker compose) switches to path-style addressing.
func NewS3(cfg aws.Config, mediaBucket, historyBucket string, endpoint ...string) *S3 {
	c := s3.NewFromConfig(cfg, func(o *s3.Options) {
		if len(endpoint) > 0 && endpoint[0] != "" {
			o.BaseEndpoint = aws.String(endpoint[0])
			o.UsePathStyle = true
		}
	})
	return &S3{client: c, presign: s3.NewPresignClient(c), media: mediaBucket, history: historyBucket}
}

func (s *S3) PresignPut(ctx context.Context, key, contentType string, expires time.Duration) (string, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.media),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func (s *S3) Put(ctx context.Context, key string, body []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.history),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String("application/x-ndjson"),
	})
	return err
}

// Package config reads runtime configuration from environment variables.
// The variable names match the ones set by infra/modules/compute.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultRadiusM = 500
	MinRadiusM     = 100
	MaxRadiusM     = 5000
)

type Config struct {
	SocialTable      string
	MailFrom         string
	FrontendURL      string
	UsersTable       string
	FriendshipsTable string
	ConnectionsTable string

	RedisHost string
	RedisPort string
	RedisTLS  bool

	LocationTTL time.Duration

	EventsQueueURL string
	MediaBucket    string
	HistoryBucket  string
	CDNDomain      string
	// Local development: S3 compatible endpoint (S3Mock) and the public base URL of the media bucket. Empty in AWS.
	S3Endpoint      string
	MediaBaseURL    string
	WSManagementURL string

	JWTSecret string
	JWTTTL    time.Duration

	// Local development only. Empty in AWS.
	DynamoEndpoint string
}

// Load reads the environment. Only the variables the caller needs are validated
// through the require list, so the worker does not demand API-only settings.
func Load(require ...string) (*Config, error) {
	c := &Config{
		SocialTable:      os.Getenv("SOCIAL_TABLE"),
		MailFrom:         os.Getenv("MAIL_FROM"),
		FrontendURL:      envOr("FRONTEND_URL", "http://localhost:5173"),
		UsersTable:       os.Getenv("USERS_TABLE"),
		FriendshipsTable: os.Getenv("FRIENDSHIPS_TABLE"),
		ConnectionsTable: os.Getenv("CONNECTIONS_TABLE"),
		RedisHost:        os.Getenv("REDIS_HOST"),
		RedisPort:        envOr("REDIS_PORT", "6379"),
		RedisTLS:         os.Getenv("REDIS_TLS") == "true",
		EventsQueueURL:   os.Getenv("EVENTS_QUEUE_URL"),
		MediaBucket:      os.Getenv("MEDIA_BUCKET"),
		HistoryBucket:    os.Getenv("HISTORY_BUCKET"),
		CDNDomain:        os.Getenv("CDN_DOMAIN"),
		S3Endpoint:       os.Getenv("S3_ENDPOINT"),
		MediaBaseURL:     strings.TrimRight(os.Getenv("MEDIA_BASE_URL"), "/"),
		WSManagementURL:  os.Getenv("WS_MANAGEMENT_URL"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		DynamoEndpoint:   os.Getenv("DYNAMODB_ENDPOINT"),
	}

	ttl, err := strconv.Atoi(envOr("LOCATION_TTL_SECONDS", "120"))
	if err != nil || ttl <= 0 {
		return nil, fmt.Errorf("LOCATION_TTL_SECONDS must be a positive integer")
	}
	c.LocationTTL = time.Duration(ttl) * time.Second

	hours, err := strconv.Atoi(envOr("JWT_TTL_HOURS", "168"))
	if err != nil || hours <= 0 {
		return nil, fmt.Errorf("JWT_TTL_HOURS must be a positive integer")
	}
	c.JWTTTL = time.Duration(hours) * time.Hour

	values := map[string]string{
		"USERS_TABLE":       c.UsersTable,
		"FRIENDSHIPS_TABLE": c.FriendshipsTable,
		"CONNECTIONS_TABLE": c.ConnectionsTable,
		"REDIS_HOST":        c.RedisHost,
		"EVENTS_QUEUE_URL":  c.EventsQueueURL,
		"MEDIA_BUCKET":      c.MediaBucket,
		"HISTORY_BUCKET":    c.HistoryBucket,
		"CDN_DOMAIN":        c.CDNDomain,
		"WS_MANAGEMENT_URL": c.WSManagementURL,
		"JWT_SECRET":        c.JWTSecret,
	}
	for _, name := range require {
		if values[name] == "" {
			return nil, fmt.Errorf("missing required environment variable %s", name)
		}
	}
	return c, nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// MediaURL is the public URL of an uploaded object: the CDN in AWS, the S3Mock bucket locally.
func (c *Config) MediaURL(key string) string {
	switch {
	case key == "":
		return ""
	case c.MediaBaseURL != "":
		return c.MediaBaseURL + "/" + key
	case c.CDNDomain != "":
		return "https://" + c.CDNDomain + "/" + key
	}
	return ""
}

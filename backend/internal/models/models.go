// Package models holds the data shapes shared across the backend.
package models

import "time"

// Friendship statuses. Each friendship is stored as two rows, one per user.
const (
	StatusPendingOut = "pending_out" // I sent the request
	StatusPendingIn  = "pending_in"  // I received the request
	StatusAccepted   = "accepted"
)

// User is the item stored in the users table (key: user_id).
type User struct {
	SessionVersion int    `dynamodbav:"session_version" json:"-"`
	UserID         string `dynamodbav:"user_id" json:"user_id"`
	Email          string `dynamodbav:"email" json:"email,omitempty"`
	Username       string `dynamodbav:"username" json:"username"`
	DisplayName    string `dynamodbav:"display_name" json:"display_name"`
	PasswordHash   string `dynamodbav:"password_hash" json:"-"`
	PhotoKey       string `dynamodbav:"photo_key,omitempty" json:"photo_key,omitempty"`
	RadiusM        int    `dynamodbav:"radius_m" json:"radius_m"`
	GhostMode      bool   `dynamodbav:"ghost_mode" json:"ghost_mode"`
	CreatedAt      int64  `dynamodbav:"created_at" json:"created_at"`
}

// Friendship is the item stored in the friendships table (key: user_id + friend_id).
type Friendship struct {
	UserID    string `dynamodbav:"user_id"`
	FriendID  string `dynamodbav:"friend_id"`
	Status    string `dynamodbav:"status"`
	CreatedAt int64  `dynamodbav:"created_at"`
}

// Connection is a live WebSocket connection (key: connection_id, TTL: expires_at).
type Connection struct {
	SessionVersion int    `dynamodbav:"session_version"`
	ConnectionID   string `dynamodbav:"connection_id"`
	UserID         string `dynamodbav:"user_id"`
	ExpiresAt      int64  `dynamodbav:"expires_at"`
}

// Location is the value stored in Redis under loc:{user_id}.
type Location struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
	TS  int64   `json:"ts"` // unix milliseconds
}

// PublicUser is what other users are allowed to see about someone.
type PublicUser struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	PhotoURL    string `json:"photo_url,omitempty"`
}

// HistoryEvent is the message sent to SQS for every accepted location update.
type HistoryEvent struct {
	Type   string    `json:"type"` // "location"
	UserID string    `json:"user_id"`
	Lat    float64   `json:"lat"`
	Lng    float64   `json:"lng"`
	TS     int64     `json:"ts"`
	At     time.Time `json:"at"`
}

// Package auth handles password hashing and JWT issuing/verification.
// Verification is done offline because the Lambda has no internet access.
package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidToken = errors.New("invalid token")

type Service struct {
	secret []byte
	ttl    time.Duration
}

func New(secret string, ttl time.Duration) *Service {
	return &Service{secret: []byte(secret), ttl: ttl}
}

func HashPassword(password string) (string, error) {
	// bcrypt rejects inputs longer than 72 bytes; the API validates length first.
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(b), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (s *Service) Issue(userID string) (string, error) {
	return s.IssueSession(userID, 0)
}

type sessionClaims struct {
	jwt.RegisteredClaims
	Version int `json:"version"`
}

func (s *Service) IssueSession(userID string, version int) (string, error) {
	now := time.Now()
	claims := sessionClaims{Version: version, RegisteredClaims: jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
	}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

// Verify returns the user id (subject) of a valid token.
func (s *Service) Verify(token string) (string, error) {
	id, _, err := s.VerifySession(token)
	return id, err
}

func (s *Service) VerifySession(token string) (string, int, error) {
	var claims sessionClaims
	_, err := jwt.ParseWithClaims(token, &claims, func(t *jwt.Token) (any, error) {
		return s.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil || claims.Subject == "" {
		return "", 0, fmt.Errorf("%w", ErrInvalidToken)
	}
	return claims.Subject, claims.Version, nil
}

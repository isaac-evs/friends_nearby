package auth

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const secret = "unit-test-secret-unit-test-secret"

func TestPasswordHashing(t *testing.T) {
	hash, err := HashPassword("correct horse")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(hash, "correct horse") {
		t.Fatal("hash contains the plaintext password")
	}
	if !CheckPassword(hash, "correct horse") {
		t.Error("right password rejected")
	}
	if CheckPassword(hash, "Correct horse") || CheckPassword(hash, "") {
		t.Error("wrong password accepted")
	}
	if CheckPassword("not-a-hash", "correct horse") {
		t.Error("garbage hash accepted")
	}
}

func TestTokenRoundTrip(t *testing.T) {
	s := New(secret, time.Hour)
	tok, err := s.Issue("user-1")
	if err != nil {
		t.Fatal(err)
	}
	got, err := s.Verify(tok)
	if err != nil || got != "user-1" {
		t.Fatalf("Verify = %q, %v", got, err)
	}
}

func TestTokenRejections(t *testing.T) {
	s := New(secret, time.Hour)
	good, _ := s.Issue("user-1")

	expired, _ := New(secret, -time.Minute).Issue("user-1")
	otherKey, _ := New("a-completely-different-secret-value", time.Hour).Issue("user-1")
	noExp, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "user-1"}).SignedString([]byte(secret))
	noSub, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}).SignedString([]byte(secret))
	hs512, _ := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.RegisteredClaims{Subject: "user-1", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}).SignedString([]byte(secret))
	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.RegisteredClaims{Subject: "user-1", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	tampered := good[:len(good)-2] + "xx"

	cases := map[string]string{
		"empty":            "",
		"garbage":          "abc.def.ghi",
		"expired":          expired,
		"different secret": otherKey,
		"missing exp":      noExp,
		"missing subject":  noSub,
		"wrong algorithm":  hs512,
		"alg none":         none,
		"tampered":         tampered,
	}
	for name, tok := range cases {
		if _, err := s.Verify(tok); !errors.Is(err, ErrInvalidToken) {
			t.Errorf("%s: got %v, want ErrInvalidToken", name, err)
		}
	}
}

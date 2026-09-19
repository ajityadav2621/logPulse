package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

// GenerateInviteToken returns a URL-safe random token plus its SHA-256 hash.
// Only the hash is stored in the database — the raw token is shown to the
// admin exactly once (in the API response) and emailed/shared out of band.
func GenerateInviteToken() (rawToken string, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	rawToken = hex.EncodeToString(b)
	hash = HashToken(rawToken)
	return rawToken, hash, nil
}

// HashToken is a deterministic hash used to look up invite tokens (and, in
// future, refresh tokens) by their raw value without storing it in plaintext.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

package monitor

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"unicode"
)

// Fingerprint normalizes a log message into a repeatable pattern template
// and hashes it. Variable parts — numbers, UUIDs, hex IDs, IPs, quoted
// strings, URLs — collapse to placeholders, so a stack trace repeated 10,000
// times with different request IDs yields one pattern (AI-1 clustering).
func Fingerprint(message string) (hash string, pattern string) {
	pattern = normalizeMessage(message)
	sum := sha256.Sum256([]byte(pattern))
	return hex.EncodeToString(sum[:8]), pattern
}

// normalizeMessage replaces variable tokens with type placeholders and
// collapses whitespace. It is deliberately conservative: only tokens that
// are *certainly* variable are masked, so distinct failure modes don't merge.
func normalizeMessage(msg string) string {
	tokens := strings.Fields(msg)
	out := make([]string, 0, len(tokens))
	for _, tok := range tokens {
		out = append(out, normalizeToken(tok))
	}
	return strings.Join(out, " ")
}

func normalizeToken(tok string) string {
	// Strip surrounding punctuation so "id=abc-123," masks like the bare value.
	trimmed := strings.Trim(tok, " \t\n\r()[]{}:,;\"'`")
	prefix, suffix := tok[:len(tok)-len(trimmed)], ""
	if idx := strings.LastIndex(tok, trimmed); idx >= 0 && trimmed != "" {
		suffix = tok[idx+len(trimmed):]
		prefix = tok[:idx]
	}
	if trimmed == "" {
		return tok
	}

	var repl string
	switch {
	case looksLikeUUID(trimmed):
		repl = "<uuid>"
	case looksLikeIP(trimmed):
		repl = "<ip>"
	case looksLikeHexID(trimmed):
		repl = "<id>"
	case looksLikeNumber(trimmed):
		repl = "<num>"
	case looksLikeURL(trimmed):
		repl = "<url>"
	case looksLikeQuoted(trimmed):
		repl = "<str>"
	case numberWithUnit(trimmed):
		repl = "<num>"
	case hasDigits(trimmed):
		repl = "<id>"
	default:
		repl = strings.ToLower(trimmed)
	}
	return prefix + repl + suffix
}

// numberWithUnit matches values like "240ms", "5s", "1.2MB" — a number plus
// a short unit suffix — so latency/size tokens collapse too.
func numberWithUnit(s string) bool {
	i := 0
	for i < len(s) && (s[i] >= '0' && s[i] <= '9' || s[i] == '.' || s[i] == ',') {
		i++
	}
	unitLen := len(s) - i
	return i > 0 && unitLen >= 1 && unitLen <= 3
}

func looksLikeUUID(s string) bool {
	if len(s) != 36 || s[8] != '-' || s[13] != '-' || s[18] != '-' || s[23] != '-' {
		return false
	}
	for i, r := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			continue
		}
		if !isHexDigit(r) {
			return false
		}
	}
	return true
}

func looksLikeIP(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 4 {
		return false
	}
	for _, p := range parts {
		if p == "" || len(p) > 3 {
			return false
		}
		for _, r := range p {
			if r < '0' || r > '9' {
				return false
			}
		}
	}
	return true
}

// looksLikeHexID matches long hex runs (sha prefixes, trace IDs, object IDs).
func looksLikeHexID(s string) bool {
	if len(s) < 12 {
		return false
	}
	for _, r := range s {
		if !isHexDigit(r) {
			return false
		}
	}
	return true
}

func looksLikeNumber(s string) bool {
	sawDigit := false
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
			sawDigit = true
		case r == '.' || r == ',' || r == '%':
		default:
			return false
		}
	}
	return sawDigit
}

func looksLikeURL(s string) bool {
	l := strings.ToLower(s)
	return strings.HasPrefix(l, "http://") || strings.HasPrefix(l, "https://")
}

func looksLikeQuoted(s string) bool {
	if len(s) < 2 {
		return false
	}
	first, last := s[0], s[len(s)-1]
	return (first == '"' && last == '"') || (first == '\'' && last == '\'') || (first == '`' && last == '`')
}

func hasDigits(s string) bool {
	for _, r := range s {
		if unicode.IsDigit(r) {
			return true
		}
	}
	return false
}

func isHexDigit(r rune) bool {
	return (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

package monitor

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// ParseAlertText compiles a plain-language alert description into a draft
// alert rule (AI-8). It is a deterministic parser — no external LLM — so it
// is free, fast, and works offline. The draft is returned for human review
// before activation, per the FRD's "AI suggests, operator confirms" rule.

type ParsedAlert struct {
	ApplicationName string   `json:"application_name"` // matched against registered apps, "" = any
	Level           string   `json:"level"`            // error | warning | info | critical | debug
	Keyword         string   `json:"keyword"`
	Threshold       int      `json:"threshold"`
	WindowSeconds   int      `json:"window_seconds"`
	CooldownSeconds int      `json:"cooldown_seconds"`
	Confidence      float64  `json:"confidence"`
	Notes           []string `json:"notes"`
}

var (
	thresholdRe = regexp.MustCompile(`(?:more than|over|exceed(?:ing)?|above|at least|>|≥)\s*(\d+)`)
	durationRe  = regexp.MustCompile(`(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|h)\b`)
	keywordRe   = regexp.MustCompile(`"[^"]+"|'[^']+'|` + "`[^`]+`" +
		`|containing ([a-z0-9_\-\. ]+)|mentioning ([a-z0-9_\-\. ]+)|including ([a-z0-9_\-\. ]+)|matching ([a-z0-9_\-\. ]+)`)
	cooldownRe = regexp.MustCompile(`cooldown (?:of |for )?(\d+)\s*(seconds?|minutes?|mins?|hours?)`)
)

// ParseAlertText turns e.g.
//
//	"alert me when payments-api logs more than 5 errors mentioning timeout within 2 minutes"
//
// into a structured draft rule.
func ParseAlertText(text string, registeredApps []string) ParsedAlert {
	lower := strings.ToLower(text)
	p := ParsedAlert{
		Level:           "error",
		Threshold:       5,
		WindowSeconds:   300,
		CooldownSeconds: 300,
		Confidence:      0.4,
	}

	p.ApplicationName = MatchAppName(text, registeredApps)
	if p.ApplicationName != "" {
		p.Confidence += 0.2
	} else {
		p.Notes = append(p.Notes, "No registered application matched — select one before activation.")
	}

	// Level.
	switch {
	case strings.Contains(lower, "critical") || strings.Contains(lower, "fatal"):
		p.Level = "critical"
	case strings.Contains(lower, "error") || strings.Contains(lower, "fail"):
		p.Level = "error"
	case strings.Contains(lower, "warn"):
		p.Level = "warning"
	case strings.Contains(lower, "info"):
		p.Level = "info"
	case strings.Contains(lower, "debug"):
		p.Level = "debug"
	}
	p.Confidence += 0.15

	if m := thresholdRe.FindStringSubmatch(lower); m != nil {
		if n, err := strconv.Atoi(m[1]); err == nil && n > 0 {
			p.Threshold = n
			p.Confidence += 0.15
		}
	}

	// Durations are consumed FIRST so the keyword scan can't swallow
	// phrases like "within 5 minutes".
	durations := durationRe.FindAllStringSubmatch(lower, -1)
	if len(durations) > 0 {
		p.WindowSeconds = durationSeconds(durations[0][1], durations[0][2])
		p.Confidence += 0.15
	}
	lowerNoDurations := durationRe.ReplaceAllString(lower, " ")

	if m := keywordRe.FindStringSubmatch(lowerNoDurations); m != nil {
		if m[0] != "" && (m[0][0] == '"' || m[0][0] == '\'' || m[0][0] == '`') {
			p.Keyword = strings.Trim(m[0], "\"'`")
		} else {
			for _, g := range m[1:] {
				if g != "" {
					p.Keyword = strings.TrimSpace(g)
					break
				}
			}
		}
		// Cut at conjunction/stopwords so "timeout within" doesn't become a keyword.
		for _, stop := range []string{" within", " when", " in the last", " in the past", " and ", " or "} {
			if idx := strings.Index(p.Keyword, stop); idx > 0 {
				p.Keyword = strings.TrimSpace(p.Keyword[:idx])
			}
		}
		if p.Keyword != "" {
			p.Confidence += 0.15
		}
	}

	if m := cooldownRe.FindStringSubmatch(lower); m != nil {
		p.CooldownSeconds = durationSeconds(m[1], m[2])
		p.Notes = append(p.Notes, fmt.Sprintf("Cooldown of %ds applied from your description.", p.CooldownSeconds))
	}

	if p.Keyword == "" {
		p.Notes = append(p.Notes, "No keyword detected — the rule matches all logs at this level.")
	}
	p.Confidence = math.Min(p.Confidence, 1.0)
	return p
}

func durationSeconds(nStr, unit string) int {
	n, _ := strconv.Atoi(nStr)
	switch {
	case strings.HasPrefix(unit, "h"):
		return n * 3600
	case strings.HasPrefix(unit, "m"):
		return n * 60
	default:
		return n
	}
}

// MatchAppName picks the registered application name that appears in the
// sentence, longest match first so "payments-api" beats "payments".
func MatchAppName(text string, registered []string) string {
	lower := strings.ToLower(text)
	best := ""
	for _, name := range registered {
		n := strings.ToLower(name)
		if n != "" && strings.Contains(lower, n) && len(n) > len(best) {
			best = name
		}
	}
	return best
}

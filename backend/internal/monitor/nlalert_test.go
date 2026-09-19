package monitor

import "testing"

func TestParseAlertTextFull(t *testing.T) {
	apps := []string{"payments-api", "checkout-web", "users"}
	p := ParseAlertText("Alert me when payments-api has more than 5 errors mentioning 'timeout' within 2 minutes, cooldown of 10 minutes", apps)

	if p.ApplicationName != "payments-api" {
		t.Errorf("app = %q, want payments-api", p.ApplicationName)
	}
	if p.Level != "error" {
		t.Errorf("level = %q, want error", p.Level)
	}
	if p.Threshold != 5 {
		t.Errorf("threshold = %d, want 5", p.Threshold)
	}
	if p.WindowSeconds != 120 {
		t.Errorf("window = %d, want 120", p.WindowSeconds)
	}
	if p.Keyword != "timeout" {
		t.Errorf("keyword = %q, want timeout", p.Keyword)
	}
	if p.CooldownSeconds != 600 {
		t.Errorf("cooldown = %d, want 600", p.CooldownSeconds)
	}
	if p.Confidence < 0.8 {
		t.Errorf("confidence = %v, want high", p.Confidence)
	}
}

func TestParseAlertTextPrefersLongerAppName(t *testing.T) {
	apps := []string{"payments", "payments-api"}
	if got := MatchAppName("alert on payments-api errors", apps); got != "payments-api" {
		t.Errorf("MatchAppName = %q, want payments-api", got)
	}
}

func TestParseAlertTextDefaults(t *testing.T) {
	p := ParseAlertText("something is failing a lot", nil)
	if p.Level != "error" || p.Threshold != 5 || p.WindowSeconds != 300 {
		t.Errorf("defaults wrong: %+v", p)
	}
	if len(p.Notes) == 0 {
		t.Error("expected review notes for a vague description")
	}
}

package email

import (
	"strings"
	"testing"
	"time"
)

func TestHTMLToTextStripsTagsAndUnescapes(t *testing.T) {
	in := "<p>Hello &amp; welcome</p><p style='x'>Click <a href=\"https://x.y\">here</a><br>Bye</p>"
	got := htmlToText(in)
	if strings.Contains(got, "<") || strings.Contains(got, "&amp;") {
		t.Fatalf("text fallback still contains markup: %q", got)
	}
	if !strings.Contains(got, "Hello & welcome") || !strings.Contains(got, "Bye") {
		t.Fatalf("text fallback lost content: %q", got)
	}
}

func TestBuildMessageMultipartAltern(t *testing.T) {
	msg := string(buildMessage("LogPulse", "from@logpulse.dev", "to@user.dev", "Reset your password", "plain fallback", "<b>html body</b>"))
	for _, want := range []string{
		"From: LogPulse <from@logpulse.dev>",
		"To: to@user.dev",
		"Subject: Reset your password",
		"multipart/alternative",
		"text/plain",
		"plain fallback",
		"text/html",
		"<b>html body</b>",
	} {
		if !strings.Contains(msg, want) {
			t.Errorf("message missing %q", want)
		}
	}
}

func TestPasswordResetEmailLinkAndExpiry(t *testing.T) {
	subject, html := PasswordResetEmail("https://app/reset-password?token=abc", 30*time.Minute)
	if subject != "Reset your LogPulse password" {
		t.Errorf("unexpected subject %q", subject)
	}
	if !strings.Contains(html, "https://app/reset-password?token=abc") {
		t.Error("email body missing reset link")
	}
	if !strings.Contains(html, "30 minutes") {
		t.Error("email body missing expiry window")
	}
}

package email

import (
	"fmt"
	"strings"
	"time"
)

const emailAccent = "#0f172a"

// PasswordResetEmail renders the forgot-password message. link points at
// <frontend>/reset-password?token=<raw> and expires after ttl.
func PasswordResetEmail(link string, ttl time.Duration) (subject, html string) {
	mins := int(ttl.Minutes())
	subject = "Reset your LogPulse password"
	html = renderShell(fmt.Sprintf(`
		<p>Someone requested a password reset for your LogPulse account.</p>
		<p>If this was you, use the button below within the next <strong>%d minutes</strong>:</p>
		<p style="margin:28px 0;">
			<a href="%s" style="display:inline-block;background:%s;color:#ffffff;text-decoration:none;
			font-weight:600;font-size:14px;padding:10px 22px;border-radius:8px;">Reset password</a>
		</p>
		<p style="color:#71717a;">Or paste this link into your browser:<br>
		<a href="%s" style="word-break:break-all;">%s</a></p>
		<p style="color:#71717a;">If you didn't request this, you can safely ignore this email —
		your password won't change unless the link is used.</p>
	`, mins, link, emailAccent, link, link))
	return subject, html
}

// UserInviteEmail renders the admin-invite message. link points at
// <frontend>/accept-invite?token=<raw>.
func UserInviteEmail(link string) (subject, html string) {
	subject = "You've been invited to LogPulse"
	html = renderShell(fmt.Sprintf(`
		<p>You've been invited to a LogPulse workspace.</p>
		<p>Use the button below to set your name and password and activate your
		account (the link is single-use):</p>
		<p style="margin:28px 0;">
			<a href="%s" style="display:inline-block;background:%s;color:#ffffff;text-decoration:none;
			font-weight:600;font-size:14px;padding:10px 22px;border-radius:8px;">Accept invite</a>
		</p>
		<p style="color:#71717a;">Or paste this link into your browser:<br>
		<a href="%s" style="word-break:break-all;">%s</a></p>
	`, link, emailAccent, link, link))
	return subject, html
}

// renderShell wraps the inner body in a minimal, dark-mode-tolerant layout:
// system fonts, white card, hairline border. No images so it renders even
// with remote content blocked.
func renderShell(inner string) string {
	return strings.TrimSpace(`<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f5;">
<div style="max-width:520px;margin:0 auto;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="font-size:18px;font-weight:700;color:` + emailAccent + `;margin-bottom:20px;">LogPulse</div>
  <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:28px;">
    <div style="font-size:14px;line-height:1.6;color:#18181b;">` + inner + `</div>
  </div>
  <div style="color:#a1a1aa;font-size:12px;margin-top:16px;line-height:1.5;">
    Sent by LogPulse. This is an automated message — replies to this address are not monitored.
  </div>
</div>
</body></html>`)
}

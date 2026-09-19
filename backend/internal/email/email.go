// Package email carries every outbound message LogPulse sends (password
// resets, invites, ...). Sending is provider-agnostic: anything implementing
// Mailer can deliver, and the shipped SMTPMailer covers any plain
// username/password+STARTTLS (or implicit-TLS) provider — Gmail today,
// SES/Resend/Mailgun later via config only.
package email

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"html"
	"mime"
	"net"
	"net/smtp"
	"regexp"
	"strings"
)

// Mailer is the transport boundary. Swapping providers is a matter of
// supplying a different implementation, not touching call sites.
type Mailer interface {
	// Send delivers one HTML message. Implementations must use TLS.
	Send(fromName, fromAddr, to, subject, htmlBody string) error
}

// SMTPMailer sends via an SMTP server. Port 465 uses implicit TLS from the
// first byte; any other port (587 in practice) dials plaintext and upgrades
// with STARTTLS before authenticating.
type SMTPMailer struct {
	Host     string
	Port     string
	Username string
	Password string
}

func NewSMTPMailer(host, port, username, password string) *SMTPMailer {
	return &SMTPMailer{Host: host, Port: port, Username: username, Password: password}
}

// Gmail (and most providers) reject unauthenticated sends; PlainAuth over
// STARTTLS is what an App Password expects.
func (m *SMTPMailer) Send(fromName, fromAddr, to, subject, htmlBody string) error {
	addr := net.JoinHostPort(m.Host, m.Port)
	msg := buildMessage(fromName, fromAddr, to, subject, htmlToText(htmlBody), htmlBody)
	tlsConf := &tls.Config{ServerName: m.Host}
	auth := smtp.PlainAuth("", m.Username, m.Password, m.Host)

	if m.Port == "465" {
		conn, err := tls.Dial("tcp", addr, tlsConf)
		if err != nil {
			return fmt.Errorf("smtp dial (implicit TLS): %w", err)
		}
		client, err := smtp.NewClient(conn, m.Host)
		if err != nil {
			conn.Close()
			return fmt.Errorf("smtp handshake: %w", err)
		}
		defer client.Close()
		return deliverWithClient(client, auth, fromAddr, to, msg)
	}

	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	client, err := smtp.NewClient(conn, m.Host)
	if err != nil {
		conn.Close()
		return fmt.Errorf("smtp handshake: %w", err)
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(tlsConf); err != nil {
			return fmt.Errorf("smtp STARTTLS: %w", err)
		}
	} else if m.Host != "localhost" && m.Host != "127.0.0.1" {
		// Refuse to authenticate in the clear to a real mail host.
		return errors.New("smtp: server does not offer STARTTLS; refusing to send credentials unencrypted")
	}
	return deliverWithClient(client, auth, fromAddr, to, msg)
}

func deliverWithClient(client *smtp.Client, auth smtp.Auth, fromAddr, to string, msg []byte) error {
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err := client.Mail(fromAddr); err != nil {
		return fmt.Errorf("smtp MAIL FROM: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp RCPT TO: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp DATA: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close: %w", err)
	}
	return client.Quit()
}

// buildMessage renders an RFC 5322 message with a multipart/alternative body
// (plain-text fallback first, HTML second — mail clients pick the last part
// they support).
func buildMessage(fromName, fromAddr, to, subject, textBody, htmlBody string) []byte {
	boundary := randomBoundary()
	var b strings.Builder

	b.WriteString("From: " + fromName + " <" + fromAddr + ">\r\n")
	b.WriteString("To: " + to + "\r\n")
	b.WriteString("Subject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n\r\n")

	b.WriteString("--" + boundary + "\r\n")
	b.WriteString("Content-Type: text/plain; charset=utf-8\r\n\r\n")
	b.WriteString(textBody)
	b.WriteString("\r\n\r\n")

	b.WriteString("--" + boundary + "\r\n")
	b.WriteString("Content-Type: text/html; charset=utf-8\r\n\r\n")
	b.WriteString(htmlBody)
	b.WriteString("\r\n\r\n")

	b.WriteString("--" + boundary + "--\r\n")
	return []byte(b.String())
}

func randomBoundary() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "logpulse-alt-boundary"
	}
	return "lp-" + hex.EncodeToString(b)
}

// htmlToText renders a crude plain-text fallback for the HTML body — enough
// for clients (and spam checkers) that want the alternative part.
var tagRe = regexp.MustCompile(`(?i)<(br|/p|/div|/h[1-6]|/li)[^>]*>`)

func htmlToText(htmlBody string) string {
	s := tagRe.ReplaceAllString(htmlBody, "\n")
	s = regexp.MustCompile(`(?s)<[^>]+>`).ReplaceAllString(s, "")
	s = html.UnescapeString(s)
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = strings.TrimSpace(l)
	}
	return strings.Join(lines, "\n")
}

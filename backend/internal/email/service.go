package email

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"logpulse/internal/models"
)

const (
	// maxAttempts caps how many times the retry worker will try one row.
	maxAttempts = 5
	// retryInterval is how often the background worker sweeps for
	// pending/failed rows. Deliberately boring: a ticker, not a queue.
	retryInterval = time.Minute
)

// Service is the DB-backed email pipeline: every outbound message is written
// as a pending row first, sent, then updated with the outcome. That gives an
// audit trail, surfaces failures, and makes sends retryable — a row is never
// lost just because SMTP hiccuped.
type Service struct {
	DB          *gorm.DB
	Mailer      Mailer // nil = not configured; rows are marked failed, bodies logged
	FromName    string
	FromAddress string
}

// NewService wires the pipeline. mailer may be nil (SMTP not configured) —
// the service still records rows so the audit trail stays complete.
func NewService(dbConn *gorm.DB, mailer Mailer, fromName, fromAddress string) *Service {
	return &Service{DB: dbConn, Mailer: mailer, FromName: fromName, FromAddress: fromAddress}
}

// Enabled reports whether real delivery is possible.
func (s *Service) Enabled() bool { return s != nil && s.Mailer != nil }

// Enqueue records an email as a pending row. Call SendPending right after
// for immediate delivery; the retry worker is the safety net, not the path.
func (s *Service) Enqueue(nType, recipientEmail, subject, htmlBody string, relatedUserID *uint) (*models.EmailNotification, error) {
	row := models.EmailNotification{
		Type:           nType,
		RecipientEmail: recipientEmail,
		Subject:        subject,
		Body:           htmlBody,
		Status:         models.EmailPending,
		RelatedUserID:  relatedUserID,
	}
	if err := s.DB.Create(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// SendPending attempts delivery of one row and persists the outcome
// (sent/failed + error message). Never panics, never blocks the caller on
// more than one send.
func (s *Service) SendPending(row *models.EmailNotification) {
	if s == nil || row == nil {
		return
	}

	attempt := row.Attempts + 1
	if err := s.DB.Model(row).Update("attempts", attempt).Error; err != nil {
		log.Printf("email: could not record attempt on notification %d: %v", row.ID, err)
	}

	if s.Mailer == nil {
		// No SMTP configured: log the body so local/dev runs can still
		// complete flows (e.g. grab the reset link from server output),
		// and mark the row failed so the situation is visible.
		log.Printf("email: SMTP not configured — NOT sent to %s. Subject: %q\n%s", row.RecipientEmail, row.Subject, row.Body)
		s.markFailed(row, "SMTP is not configured (set SMTP_USERNAME/SMTP_PASSWORD)")
		return
	}

	err := s.Mailer.Send(s.FromName, s.FromAddress, row.RecipientEmail, row.Subject, row.Body)
	switch {
	case err == nil:
		now := time.Now()
		if uerr := s.DB.Model(row).Updates(map[string]interface{}{"status": models.EmailSent, "sent_at": now, "error_message": ""}).Error; uerr != nil {
			log.Printf("email: sent notification %d but could not update status: %v", row.ID, uerr)
		}
	default:
		s.markFailed(row, err.Error())
	}
}

func (s *Service) markFailed(row *models.EmailNotification, msg string) {
	if uerr := s.DB.Model(row).Updates(map[string]interface{}{"status": models.EmailFailed, "error_message": truncate(msg, 500)}).Error; uerr != nil {
		log.Printf("email: could not record failure for notification %d: %v", row.ID, uerr)
	}
}

// StartRetryWorker sweeps pending/failed rows every retryInterval until ctx
// is cancelled. Failed rows that exhausted maxAttempts are left alone.
func (s *Service) StartRetryWorker(ctx context.Context, interval time.Duration) {
	if s == nil || s.Mailer == nil {
		return
	}
	if interval <= 0 {
		interval = retryInterval
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.retryOnce()
			}
		}
	}()
}

func (s *Service) retryOnce() {
	var rows []models.EmailNotification
	err := s.DB.
		Where("status = ? OR (status = ? AND attempts < ?)", models.EmailPending, models.EmailFailed, maxAttempts).
		Order("created_at asc").Limit(20).Find(&rows).Error
	if err != nil {
		log.Printf("email: retry sweep failed: %v", err)
		return
	}
	for i := range rows {
		s.SendPending(&rows[i])
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// SendAndRecord is the one-liner most call sites want: enqueue + immediate
// send attempt. Errors from enqueue are returned (callers decide whether the
// request can still succeed); send failures are recorded on the row.
func (s *Service) SendAndRecord(nType, recipientEmail, subject, htmlBody string, relatedUserID *uint) error {
	if s == nil {
		return fmt.Errorf("email service not wired up")
	}
	row, err := s.Enqueue(nType, recipientEmail, subject, htmlBody, relatedUserID)
	if err != nil {
		return err
	}
	s.SendPending(row)
	return nil
}

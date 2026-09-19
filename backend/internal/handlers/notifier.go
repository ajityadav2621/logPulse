package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
	"sync"

	"gorm.io/gorm"

	"logpulse/internal/models"
)

type Notifier interface {
	Notify(rule models.AlertRule, appName string, count int64)
}

type ConsoleNotifier struct{}

func (n *ConsoleNotifier) Notify(rule models.AlertRule, appName string, count int64) {
	log.Printf("[ALERT] App=%s Level=%s Keyword=%s Count=%d Threshold=%d Window=%ds",
		appName, rule.Level, rule.Keyword, count, rule.Threshold, rule.WindowSeconds)
}

// WebhookNotifier posts the alert payload to a generic HTTP endpoint —
// works with Slack incoming webhooks, Discord, n8n, or anything that
// accepts JSON, so notification channels stay free to choose.
type WebhookNotifier struct {
	WebhookURL string
}

func (n *WebhookNotifier) Notify(rule models.AlertRule, appName string, count int64) {
	payload := map[string]interface{}{
		"text": fmt.Sprintf(
			"🚨 LogPulse alert: app %q hit %d %s logs within %ds (threshold %d)",
			appName, count, rule.Level, rule.WindowSeconds, rule.Threshold,
		),
		"app":       appName,
		"level":     rule.Level,
		"keyword":   rule.Keyword,
		"count":     count,
		"threshold": rule.Threshold,
		"window":    rule.WindowSeconds,
		"time":      time.Now().Format(time.RFC3339),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(n.WebhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[WEBHOOK] delivery failed: %v", err)
		return
	}
	resp.Body.Close()
}

type InAppNotifier struct {
	DB *gorm.DB
}

func (n *InAppNotifier) Notify(rule models.AlertRule, appName string, count int64) {
	var admins []models.User
	if err := n.DB.Where("role = ?", models.RoleAdmin).Find(&admins).Error; err != nil {
		return
	}

	desc := fmt.Sprintf("Application %s logged %d %s events within %ds, exceeding threshold (%d/%d)",
		appName, count, rule.Level, rule.WindowSeconds, count, rule.Threshold)
	if rule.Keyword != "" {
		desc += fmt.Sprintf(" matching %q", rule.Keyword)
	}

	for _, admin := range admins {
		n.DB.Create(&models.Notification{
			UserID:  admin.ID,
			Title:   "Alert triggered: " + rule.Level,
			Message: desc,
			Type:    "alert",
		})
	}
}

// MultiNotifier fans an alert out to every configured channel.
type MultiNotifier struct {
	Notifiers []Notifier
}

func (m *MultiNotifier) Notify(rule models.AlertRule, appName string, count int64) {
	for _, n := range m.Notifiers {
		n.Notify(rule, appName, count)
	}
}

var (
	globalNotifier   Notifier
	globalNotifierMu sync.RWMutex
)

func SetNotifier(n Notifier) {
	globalNotifierMu.Lock()
	globalNotifier = n
	globalNotifierMu.Unlock()
}

func GetNotifier() Notifier {
	globalNotifierMu.RLock()
	defer globalNotifierMu.RUnlock()
	return globalNotifier
}

func sendWebhook(url string, rule models.AlertRule, appName string, count int64) {
	n := &WebhookNotifier{WebhookURL: url}
	n.Notify(rule, appName, count)
}

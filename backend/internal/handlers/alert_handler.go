package handlers

import (
	"context"
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

type AlertHandler struct {
	DB         *gorm.DB
	Collection *mongo.Collection
	Notifier   Notifier
	WebhookURL string
}

type createAlertReq struct {
	ApplicationID   uint   `json:"application_id" binding:"required"`
	Name            string `json:"name"`
	Level           string `json:"level" binding:"required"`
	Keyword         string `json:"keyword"`
	Threshold       int    `json:"threshold" binding:"required,min=1"`
	WindowSeconds   int    `json:"window_seconds" binding:"required,min=1"`
	CooldownSeconds int    `json:"cooldown_seconds"`
}

type updateAlertReq struct {
	Name            *string `json:"name"`
	Level           *string `json:"level"`
	Keyword         *string `json:"keyword"`
	Threshold       *int    `json:"threshold"`
	WindowSeconds   *int    `json:"window_seconds"`
	CooldownSeconds *int    `json:"cooldown_seconds"`
	Enabled         *bool   `json:"enabled"`
}

// AlertRuleView is the API shape: the rule plus the resolved app name so the
// UI doesn't have to map application IDs itself.
type AlertRuleView struct {
	models.AlertRule
	ApplicationName string `json:"application_name"`
}

func (h *AlertHandler) List(c *gin.Context) {
	var rules []models.AlertRule
	query := h.DB.Order("id desc")
	if appID := c.Query("application_id"); appID != "" {
		query = query.Where("application_id = ?", appID)
	}
	if err := query.Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	appNames := h.appNameMap()
	views := make([]AlertRuleView, 0, len(rules))
	for _, r := range rules {
		views = append(views, AlertRuleView{AlertRule: r, ApplicationName: appNames[r.ApplicationID]})
	}
	c.JSON(http.StatusOK, views)
}

func (h *AlertHandler) appNameMap() map[uint]string {
	var apps []models.Application
	if err := h.DB.Select("id, name").Find(&apps).Error; err != nil {
		return map[uint]string{}
	}
	m := make(map[uint]string, len(apps))
	for _, a := range apps {
		m[a.ID] = a.Name
	}
	return m
}

func (h *AlertHandler) Create(c *gin.Context) {
	var req createAlertReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule := models.AlertRule{
		ApplicationID:   req.ApplicationID,
		Name:            req.Name,
		Level:           req.Level,
		Keyword:         req.Keyword,
		Threshold:       req.Threshold,
		WindowSeconds:   req.WindowSeconds,
		CooldownSeconds: req.CooldownSeconds,
		Enabled:         true,
	}
	if rule.CooldownSeconds <= 0 {
		rule.CooldownSeconds = 300 // sane default: at most one page per 5 min
	}
	if rule.Name == "" {
		rule.Name = rule.Level + " threshold"
	}
	if err := h.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create alert rule"})
		return
	}
	c.JSON(http.StatusCreated, rule)
}

func (h *AlertHandler) Update(c *gin.Context) {
	var rule models.AlertRule
	if err := h.DB.First(&rule, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert rule not found"})
		return
	}

	var req updateAlertReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Level != nil {
		updates["level"] = *req.Level
	}
	if req.Keyword != nil {
		updates["keyword"] = *req.Keyword
	}
	if req.Threshold != nil {
		updates["threshold"] = *req.Threshold
	}
	if req.WindowSeconds != nil {
		updates["window_seconds"] = *req.WindowSeconds
	}
	if req.CooldownSeconds != nil {
		updates["cooldown_seconds"] = *req.CooldownSeconds
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if len(updates) > 0 {
		if err := h.DB.Model(&rule).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
			return
		}
	}
	c.JSON(http.StatusOK, rule)
}

func (h *AlertHandler) Delete(c *gin.Context) {
	var rule models.AlertRule
	if err := h.DB.First(&rule, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert rule not found"})
		return
	}
	h.DB.Delete(&rule)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// AlertEvents returns the trigger history — fired and suppressed — newest
// first. Powers the Alert History / triage tab.
func (h *AlertHandler) Events(c *gin.Context) {
	limit := 100
	var events []models.AlertEvent
	query := h.DB.Order("created_at desc").Limit(limit)
	if ruleID := c.Query("rule_id"); ruleID != "" {
		query = query.Where("rule_id = ?", ruleID)
	}
	if err := query.Find(&events).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	if events == nil {
		events = []models.AlertEvent{}
	}
	c.JSON(http.StatusOK, events)
}

// EvaluateLog checks every enabled rule for this app against the recent log
// window. On breach it records an AlertEvent and notifies — unless the rule
// is still inside its cooldown, in which case the event is marked suppressed
// so on-call isn't paged repeatedly for one root cause (AI-6 triage).
func (h *AlertHandler) EvaluateLog(ctx context.Context, appName string, level string, message string) {
	var rules []models.AlertRule
	if err := h.DB.Where(
		"enabled = ? AND application_id IN (SELECT id FROM applications WHERE name = ?)",
		true, appName,
	).Find(&rules).Error; err != nil {
		return
	}

	for _, rule := range rules {
		if rule.Level != level {
			continue
		}
		if rule.Keyword != "" && !containsSubstr(message, rule.Keyword) {
			continue
		}

		window := time.Duration(rule.WindowSeconds) * time.Second
		since := time.Now().Add(-window)

		filter := bson.M{
			"app_name":  appName,
			"level":     level,
			"timestamp": bson.M{"$gte": since},
		}
		if rule.Keyword != "" {
			filter["message"] = bson.M{"$regex": regexp.QuoteMeta(rule.Keyword), "$options": "i"}
		}

		mctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		count, err := h.Collection.CountDocuments(mctx, filter)
		cancel()
		if err != nil {
			continue
		}

		if count < int64(rule.Threshold) {
			continue
		}

		event := models.AlertEvent{
			RuleID:        rule.ID,
			AppName:       appName,
			Level:         rule.Level,
			Keyword:       rule.Keyword,
			Count:         count,
			Threshold:     rule.Threshold,
			WindowSeconds: rule.WindowSeconds,
		}

		// Triage: if this rule fired within its cooldown, suppress.
		var lastFired models.AlertEvent
		inCooldown := h.DB.Where(
			"rule_id = ? AND suppressed = ? AND created_at > ?",
			rule.ID, false, time.Now().Add(-time.Duration(rule.CooldownSeconds)*time.Second),
		).Order("created_at desc").First(&lastFired).Error == nil

		if inCooldown {
			event.Suppressed = true
		}

		if err := h.DB.Create(&event).Error; err != nil {
			continue
		}

		if event.Suppressed {
			continue
		}

		if h.Notifier != nil {
			h.Notifier.Notify(rule, appName, count)
		}
		if h.WebhookURL != "" {
			sendWebhook(h.WebhookURL, rule, appName, count)
		}
	}
}

func containsSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

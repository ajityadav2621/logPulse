package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"

	"logpulse/internal/models"
	"logpulse/internal/monitor"
)

// MonitorHandler exposes the advanced-monitoring read side: overview stats,
// timeseries, clusters (AI-1), anomalies (AI-2), per-app health, forecasting
// (AI-7), incidents with the root-cause analysis (AI-5), and NL alert
// parsing (AI-8).
type MonitorHandler struct {
	DB         *gorm.DB
	Collection *mongo.Collection

	Agg       *monitor.Aggregator
	Detector  *monitor.Detector
}

func NewMonitorHandler(db *gorm.DB, collection *mongo.Collection) *MonitorHandler {
	agg := &monitor.Aggregator{Collection: collection}
	detector := &monitor.Detector{Agg: agg, DB: db}
	return &MonitorHandler{DB: db, Collection: collection, Agg: agg, Detector: detector}
}

// ---- query param helpers ----

func queryHours(c *gin.Context, def int) int {
	if v := c.Query("hours"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 24*30 {
			return n
		}
	}
	return def
}

func queryApp(c *gin.Context) string { return c.Query("app") }

// ---- stats ----

// Overview handles GET /api/stats/overview.
func (h *MonitorHandler) Overview(c *gin.Context) {
	ov, err := h.Agg.Overview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "stats query failed"})
		return
	}

	// Postgres-side counters round out the picture.
	h.DB.Model(&models.Incident{}).Where("status IN ?", []models.IncidentStatus{models.IncidentOpen, models.IncidentAck}).Count(&ov.OpenIncidents)
	h.DB.Model(&models.Incident{}).Where("status = ? AND source IN ?", models.IncidentOpen, []string{"anomaly", "correlation"}).Count(&ov.OpenAnomalies)
	h.DB.Model(&models.AlertEvent{}).Where("suppressed = ? AND created_at > ?", true, time.Now().Add(-1*time.Hour)).Count(&ov.Suppressed1h)

	c.JSON(http.StatusOK, ov)
}

// Timeseries handles GET /api/stats/timeseries?app=&hours=&bucket=minute|hour|day.
func (h *MonitorHandler) Timeseries(c *gin.Context) {
	hours := queryHours(c, 24)
	bucket := time.Hour
	switch c.Query("bucket") {
	case "minute":
		bucket = time.Minute
	case "day":
		bucket = 24 * time.Hour
	}
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	points, err := h.Agg.Timeseries(c.Request.Context(), queryApp(c), since, time.Now(), bucket)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "timeseries query failed"})
		return
	}
	if points == nil {
		points = []monitor.BucketPoint{}
	}
	c.JSON(http.StatusOK, points)
}

// TopApps handles GET /api/stats/top-apps?hours=24.
func (h *MonitorHandler) TopApps(c *gin.Context) {
	since := time.Now().Add(-time.Duration(queryHours(c, 24)) * time.Hour)
	apps, err := h.Agg.TopApps(c.Request.Context(), since, 8)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	if apps == nil {
		apps = []monitor.TopApp{}
	}
	c.JSON(http.StatusOK, apps)
}

// LevelCounts handles GET /api/stats/levels?app=&hours=24.
func (h *MonitorHandler) LevelCounts(c *gin.Context) {
	since := time.Now().Add(-time.Duration(queryHours(c, 24)) * time.Hour)
	counts, err := h.Agg.LevelCounts(c.Request.Context(), queryApp(c), since)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, counts)
}

// AppHealth handles GET /api/health/apps — per-application ingest health
// for the Servers page.
func (h *MonitorHandler) AppHealth(c *gin.Context) {
	health, err := h.Agg.AppHealth(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, health)
}

// ---- AI-1: clusters ----

// Clusters handles GET /api/clusters?hours=24&app=&level=&min_count=2&limit=50.
func (h *MonitorHandler) Clusters(c *gin.Context) {
	hours := queryHours(c, 24)
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	minCount := int64(2)
	if v := c.Query("min_count"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 1 {
			minCount = n
		}
	}
	limit := int64(50)
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 1 && n <= 200 {
			limit = n
		}
	}

	clusters, err := h.Agg.Clusters(c.Request.Context(), queryApp(c), c.Query("level"), since, minCount, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cluster query failed"})
		return
	}
	if clusters == nil {
		clusters = []monitor.Cluster{}
	}
	c.JSON(http.StatusOK, clusters)
}

// ---- AI-2: anomalies ----

type anomaliesResponse struct {
	Results []monitor.AnomalyResult `json:"results"`
	Note    string                  `json:"note"`
}

// Anomalies handles GET /api/anomalies?window=15 — a live sweep computed on
// request. The background detector persists anything it finds as incidents.
func (h *MonitorHandler) Anomalies(c *gin.Context) {
	results, err := h.Detector.Detect(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "anomaly detection failed"})
		return
	}
	if results == nil {
		results = []monitor.AnomalyResult{}
	}
	c.JSON(http.StatusOK, anomaliesResponse{
		Results: results,
		Note:    "z-score detection against each app's 7-day baseline (volume and error rate). Auto-detected findings are persisted as incidents.",
	})
}

// ---- AI-7: forecast ----

// Forecast handles GET /api/forecast?app=.
func (h *MonitorHandler) Forecast(c *gin.Context) {
	fc, err := h.Detector.Forecast(c.Request.Context(), queryApp(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "forecast failed"})
		return
	}
	c.JSON(http.StatusOK, fc)
}

// ---- incidents (AI-4 / AI-5) ----

type createIncidentReq struct {
	Title        string `json:"title" binding:"required"`
	Severity     string `json:"severity"`
	AffectedApps string `json:"affected_apps"` // comma-separated names
	Summary      string `json:"summary"`
}

func (h *MonitorHandler) ListIncidents(c *gin.Context) {
	var incidents []models.Incident
	query := h.DB.Order("created_at desc").Limit(200)
	switch status := c.Query("status"); status {
	case "active":
		query = query.Where("status IN ?", []models.IncidentStatus{models.IncidentOpen, models.IncidentAck})
	case "open", "acknowledged", "resolved":
		query = query.Where("status = ?", models.IncidentStatus(status))
	}
	if err := query.Find(&incidents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	if incidents == nil {
		incidents = []models.Incident{}
	}
	c.JSON(http.StatusOK, incidents)
}

func (h *MonitorHandler) CreateIncident(c *gin.Context) {
	var req createIncidentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sev := req.Severity
	if sev == "" {
		sev = "error"
	}

	inc := models.Incident{
		Title:      req.Title,
		Severity:   sev,
		Status:     models.IncidentOpen,
		Source:     "manual",
		Summary:    req.Summary,
		StartedAt:  time.Now(),
	}
	if apps := c.PostForm("affected_apps"); apps != "" {
		inc.AffectedApps = apps
	}
	if userID, ok := currentUserID(c); ok {
		inc.CreatedByUserID = &userID
	}
	if inc.AffectedApps == "" {
		inc.AffectedApps = "[]"
	}

	if err := h.DB.Create(&inc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create incident"})
		return
	}
	c.JSON(http.StatusCreated, inc)
}

func (h *MonitorHandler) GetIncident(c *gin.Context) {
	var inc models.Incident
	if err := h.DB.First(&inc, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "incident not found"})
		return
	}
	c.JSON(http.StatusOK, inc)
}

type updateIncidentReq struct {
	Status  *string `json:"status"`
	Severity *string `json:"severity"`
	Summary *string `json:"summary"`
	Title   *string `json:"title"`
}

func (h *MonitorHandler) UpdateIncident(c *gin.Context) {
	var inc models.Incident
	if err := h.DB.First(&inc, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "incident not found"})
		return
	}

	var req updateIncidentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{"updated_at": time.Now()}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.Summary != nil {
		updates["summary"] = *req.Summary
	}
	if req.Status != nil {
		status := models.IncidentStatus(*req.Status)
		switch status {
		case models.IncidentOpen, models.IncidentAck, models.IncidentClosed:
			updates["status"] = status
			if status == models.IncidentClosed {
				now := time.Now()
				updates["resolved_at"] = &now
			} else {
				updates["resolved_at"] = nil
			}
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
			return
		}
	}

	if err := h.DB.Model(&inc).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
		return
	}
	c.JSON(http.StatusOK, inc)
}

// IncidentAnalysis handles GET /api/incidents/:id/analysis — the AI-5
// root-cause copilot: timeline, failure signatures, field hints, and
// evidence-cited hypotheses.
func (h *MonitorHandler) IncidentAnalysis(c *gin.Context) {
	var inc models.Incident
	if err := h.DB.First(&inc, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "incident not found"})
		return
	}

	analysis, err := h.Detector.AnalyzeIncident(c.Request.Context(), &inc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "analysis failed"})
		return
	}
	c.JSON(http.StatusOK, analysis)
}

// ---- AI-8: NL alert authoring ----

type parseAlertReq struct {
	Text string `json:"text" binding:"required"`
}

// ParseAlert handles POST /api/alerts/parse — compiles the description into
// a draft rule. Nothing is activated; the client reviews and POSTs to
// /api/alerts to create it.
func (h *MonitorHandler) ParseAlert(c *gin.Context) {
	var req parseAlertReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var apps []models.Application
	h.DB.Select("name").Find(&apps)
	names := make([]string, 0, len(apps))
	for _, a := range apps {
		names = append(names, a.Name)
	}

	draft := monitor.ParseAlertText(req.Text, names)
	if draft.ApplicationName != "" {
		var app models.Application
		if err := h.DB.Where("name = ?", draft.ApplicationName).First(&app).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"draft": draft, "application_id": app.ID})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"draft": draft, "application_id": nil})
}

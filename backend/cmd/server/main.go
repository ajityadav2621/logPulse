package main

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"logpulse/internal/auth"
	"logpulse/internal/config"
	"logpulse/internal/db"
	"logpulse/internal/handlers"
	"logpulse/internal/middleware"
	"logpulse/internal/models"
	"logpulse/internal/ws"
)

func main() {
	cfg := config.Load()

	pg, err := db.ConnectPostgres(cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("postgres connection failed: %v", err)
	}

	if err := db.SeedAdmin(pg, cfg.SeedAdminName, cfg.SeedAdminEmail, cfg.SeedAdminPassword); err != nil {
		log.Fatalf("failed to seed admin account: %v", err)
	}

	mongoDB, err := db.ConnectMongo(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		log.Fatalf("mongo connection failed: %v", err)
	}
	logsCollection := mongoDB.Collection("logs")

	hub := ws.NewHub()

	authHandler := &handlers.AuthHandler{DB: pg, JWTSecret: cfg.JWTSecret}
	adminHandler := &handlers.AdminHandler{DB: pg}
	oauthHandler := &handlers.OAuthHandler{
		DB:           pg,
		JWTSecret:    cfg.JWTSecret,
		FrontendURL:  cfg.FrontendURL,
		GoogleConfig: auth.NewGoogleOAuthConfig(cfg),
		GitHubConfig: auth.NewGitHubOAuthConfig(cfg),
	}
	consoleNotifier := &handlers.ConsoleNotifier{}
	inAppNotifier := &handlers.InAppNotifier{DB: pg}
	notifiers := []handlers.Notifier{inAppNotifier}
	if cfg.AlertWebhookURL != "" {
		notifiers = append(notifiers, &handlers.WebhookNotifier{WebhookURL: cfg.AlertWebhookURL})
	}
	handlers.SetNotifier(&handlers.MultiNotifier{Notifiers: notifiers})

	alertHandler := &handlers.AlertHandler{
		DB:         pg,
		Collection: logsCollection,
		Notifier:   consoleNotifier,
		WebhookURL: cfg.AlertWebhookURL,
	}
	applicationHandler := &handlers.ApplicationHandler{DB: pg}
	savedSearchHandler := &handlers.SavedSearchHandler{DB: pg}
	dashboardHandler := &handlers.DashboardHandler{DB: pg}
	reportHandler := &handlers.ReportHandler{DB: pg, Collection: logsCollection}
	notificationHandler := &handlers.NotificationHandler{DB: pg}
	monitorHandler := handlers.NewMonitorHandler(pg, logsCollection)

	logHandler := &handlers.LogHandler{Collection: logsCollection, Hub: hub, Alerts: alertHandler}

	// Background anomaly detection (AI-2) + cross-service correlation (AI-4).
	// Findings persist as incidents and notify admins in-app.
	detectorCtx, cancelDetector := context.WithCancel(context.Background())
	defer cancelDetector()
	monitorHandler.Detector.DB = pg
	monitorHandler.Detector.Interval = cfg.AnomalyInterval
	monitorHandler.Detector.Run(detectorCtx)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", cfg.FrontendURL)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// ---- Auth: email/password + OAuth ----
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/login", authHandler.Login)
		authGroup.POST("/accept-invite", authHandler.AcceptInvite)
		authGroup.GET("/google/login", oauthHandler.GoogleLogin)
		authGroup.GET("/google/callback", oauthHandler.GoogleCallback)
		authGroup.GET("/github/login", oauthHandler.GitHubLogin)
		authGroup.GET("/github/callback", oauthHandler.GitHubCallback)
	}

	// ---- Authenticated routes ----
	protected := r.Group("/api")
	protected.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		protected.GET("/auth/me", authHandler.Me)
		protected.GET("/logs", logHandler.List)

		// ---- Advanced monitoring (stats, AI-1..AI-8) ----
		protected.GET("/stats/overview", monitorHandler.Overview)
		protected.GET("/stats/timeseries", monitorHandler.Timeseries)
		protected.GET("/stats/top-apps", monitorHandler.TopApps)
		protected.GET("/stats/levels", monitorHandler.LevelCounts)
		protected.GET("/health/apps", monitorHandler.AppHealth)
		protected.GET("/clusters", monitorHandler.Clusters)
		protected.GET("/anomalies", monitorHandler.Anomalies)
		protected.GET("/forecast", monitorHandler.Forecast)

		protected.GET("/incidents", monitorHandler.ListIncidents)
		protected.POST("/incidents", monitorHandler.CreateIncident)
		protected.GET("/incidents/:id", monitorHandler.GetIncident)
		protected.PATCH("/incidents/:id", monitorHandler.UpdateIncident)
		protected.GET("/incidents/:id/analysis", monitorHandler.IncidentAnalysis)

		protected.POST("/alerts/parse", monitorHandler.ParseAlert)

		protected.GET("/applications", applicationHandler.List)
		protected.POST("/applications", applicationHandler.Create)

		protected.GET("/alerts", alertHandler.List)
		protected.POST("/alerts", alertHandler.Create)
		protected.PATCH("/alerts/:id", alertHandler.Update)
		protected.DELETE("/alerts/:id", alertHandler.Delete)
		protected.GET("/alerts/events", alertHandler.Events)

		protected.GET("/saved-searches", savedSearchHandler.List)
		protected.POST("/saved-searches", savedSearchHandler.Create)
		protected.PATCH("/saved-searches/:id", savedSearchHandler.Update)
		protected.DELETE("/saved-searches/:id", savedSearchHandler.Delete)

		protected.GET("/dashboards", dashboardHandler.List)
		protected.POST("/dashboards", dashboardHandler.Create)
		protected.PATCH("/dashboards/:id", dashboardHandler.Update)
		protected.DELETE("/dashboards/:id", dashboardHandler.Delete)
		protected.POST("/dashboards/widgets", dashboardHandler.AddWidget)
		protected.GET("/dashboards/:id/widgets", dashboardHandler.ListWidgets)
		protected.DELETE("/dashboards/widgets/:widget_id", dashboardHandler.DeleteWidget)

		protected.GET("/reports", reportHandler.List)
		protected.POST("/reports", reportHandler.Create)
		protected.DELETE("/reports/:id", reportHandler.Delete)
		protected.GET("/reports/:id/export", reportHandler.Export)

		protected.GET("/notifications", notificationHandler.List)
		protected.POST("/notifications", notificationHandler.Create)
		protected.POST("/notifications/:id/read", notificationHandler.MarkRead)
		protected.POST("/notifications/read-all", notificationHandler.MarkAllRead)
		protected.GET("/notifications/unread-count", notificationHandler.UnreadCount)
	}

	// ---- Admin-only ----
	admin := r.Group("/api/admin")
	admin.Use(middleware.JWTAuth(cfg.JWTSecret), middleware.RequireRole(models.RoleAdmin))
	{
		admin.GET("/users", adminHandler.ListUsers)
		admin.POST("/users", adminHandler.CreateUser)
		admin.PATCH("/users/:id/role", adminHandler.UpdateUserRole)
		admin.POST("/users/:id/deactivate", adminHandler.DeactivateUser)
		admin.POST("/users/:id/reactivate", adminHandler.ReactivateUser)
		admin.GET("/audit-logs", adminHandler.ListAuditLogs)

		admin.DELETE("/applications/:id", applicationHandler.Delete)
	}

	// Ingest endpoint protected by API key.
	r.POST("/api/logs", middleware.APIKeyAuth(pg), logHandler.Ingest)

	// ---- Live stream ----
	r.GET("/ws/logs", func(c *gin.Context) {
		hub.ServeWS(c.Writer, c.Request)
	})

	log.Printf("LogPulse backend running on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}

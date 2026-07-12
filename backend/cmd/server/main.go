package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"logpulse/internal/config"
	"logpulse/internal/db"
	"logpulse/internal/handlers"
	"logpulse/internal/middleware"
	"logpulse/internal/ws"
)

func main() {
	cfg := config.Load()

	pg, err := db.ConnectPostgres(cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("postgres connection failed: %v", err)
	}

	mongoDB, err := db.ConnectMongo(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		log.Fatalf("mongo connection failed: %v", err)
	}
	logsCollection := mongoDB.Collection("logs")

	hub := ws.NewHub()

	authHandler := &handlers.AuthHandler{DB: pg, JWTSecret: cfg.JWTSecret}
	logHandler := &handlers.LogHandler{Collection: logsCollection, Hub: hub}

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Feature 1: auth
	r.POST("/api/auth/signup", authHandler.Signup)
	r.POST("/api/auth/login", authHandler.Login)

	// Feature 2 & 4: ingest + search (protect ingest with API key in v2; open for MVP)
	r.POST("/api/logs", logHandler.Ingest)

	protected := r.Group("/api")
	protected.Use(middleware.JWTAuth(cfg.JWTSecret))
	protected.GET("/logs", logHandler.List)

	// Feature 3: live stream
	r.GET("/ws/logs", func(c *gin.Context) {
		hub.ServeWS(c.Writer, c.Request)
	})

	log.Printf("LogPulse backend running on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}

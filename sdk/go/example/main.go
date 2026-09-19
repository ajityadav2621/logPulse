package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/logpulse/logpulse-go"
	"github.com/logpulse/logpulse-go/middleware"
)

func main() {
	client := logpulse.New(
		"my-app-api-key",
		"payments-api",
		logpulse.WithBaseURL("http://localhost:8080"),
		logpulse.WithBufferSize(100),
	)
	defer client.Close()

	// Structured logging
	client.Info("service started", map[string]interface{}{
		"version": "1.2.3",
		"env":     "production",
	})

	client.Warn("high latency detected", map[string]interface{}{
		"latency_ms": 1200,
		"endpoint":   "/charge",
	})

	client.Error("failed to charge card", map[string]interface{}{
		"order_id":  "ord_12345",
		"user_id":   "usr_67890",
		"error":     "card_declined",
	})

	fmt.Println("Logs sent. Press Ctrl+C to exit.")

	r := gin.Default()
	r.Use(middleware.Gin(client))
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
	r.Run(":8081")
}

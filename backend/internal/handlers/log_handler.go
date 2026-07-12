package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"logpulse/internal/models"
	"logpulse/internal/ws"
)

type LogHandler struct {
	Collection *mongo.Collection
	Hub        *ws.Hub
}

type ingestReq struct {
	AppName string                 `json:"app_name" binding:"required"`
	Level   string                 `json:"level" binding:"required"` // info | warn | error
	Message string                 `json:"message" binding:"required"`
	Meta    map[string]interface{} `json:"meta,omitempty"`
}

// Ingest handles POST /api/logs — feature 2.
func (h *LogHandler) Ingest(c *gin.Context) {
	var req ingestReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	entry := models.LogEntry{
		AppName:   req.AppName,
		Level:     req.Level,
		Message:   req.Message,
		Meta:      req.Meta,
		Timestamp: time.Now(),
	}

	ctx, cancel := context.WithTimeout(c, 5*time.Second)
	defer cancel()

	if _, err := h.Collection.InsertOne(ctx, entry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store log"})
		return
	}

	// Push to any connected dashboards in real time — feature 3.
	h.Hub.Broadcast(entry)

	c.JSON(http.StatusCreated, gin.H{"status": "stored"})
}

// List handles GET /api/logs?app=&level=&q= — feature 4 (search/filter).
func (h *LogHandler) List(c *gin.Context) {
	filter := bson.M{}

	if app := c.Query("app"); app != "" {
		filter["app_name"] = app
	}
	if level := c.Query("level"); level != "" {
		filter["level"] = level
	}
	if q := c.Query("q"); q != "" {
		filter["message"] = bson.M{"$regex": q, "$options": "i"}
	}

	ctx, cancel := context.WithTimeout(c, 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.M{"timestamp": -1}).SetLimit(200)
	cursor, err := h.Collection.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer cursor.Close(ctx)

	var results []models.LogEntry
	if err := cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "decode failed"})
		return
	}

	c.JSON(http.StatusOK, results)
}

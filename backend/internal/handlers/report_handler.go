package handlers

import (
	"context"
	"encoding/csv"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

type ReportHandler struct {
	DB         *gorm.DB
	Collection *mongo.Collection
}

type createReportReq struct {
	Name    string `json:"name" binding:"required"`
	Type    string `json:"type" binding:"required"`   // daily, weekly, monthly, custom
	Format  string `json:"format" binding:"required"` // csv, pdf
	Filters string `json:"filters"`
}

func (h *ReportHandler) List(c *gin.Context) {
	userID, _ := currentUserID(c)
	var reports []models.Report
	if err := h.DB.Where("user_id = ?", userID).Order("updated_at desc").Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, reports)
}

func (h *ReportHandler) Create(c *gin.Context) {
	var req createReportReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	report := models.Report{
		Name:    req.Name,
		Type:    req.Type,
		Format:  req.Format,
		Filters: req.Filters,
		UserID:  userID,
	}
	if err := h.DB.Create(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create report"})
		return
	}
	c.JSON(http.StatusCreated, report)
}

func (h *ReportHandler) Delete(c *gin.Context) {
	userID, _ := currentUserID(c)
	var report models.Report
	if err := h.DB.First(&report, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}
	if report.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	h.DB.Delete(&report)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *ReportHandler) Export(c *gin.Context) {
	reportID := c.Param("id")
	var report models.Report
	if err := h.DB.First(&report, reportID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}

	filter := bson.M{}
	if report.Filters != "" {
		// Simple filter parsing - in production use a proper parser
		parts := strings.Split(report.Filters, "&")
		for _, part := range parts {
			kv := strings.SplitN(part, "=", 2)
			if len(kv) == 2 {
				filter[kv[0]] = kv[1]
			}
		}
	}

	var cursor *mongo.Cursor
	var err error
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	cursor, err = h.Collection.Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer cursor.Close(ctx)

	var logs []models.LogEntry
	if err := cursor.All(ctx, &logs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "decode failed"})
		return
	}

	if report.Format == "csv" {
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", `attachment; filename="report_`+reportID+`.csv"`)
		writer := csv.NewWriter(c.Writer)
		writer.Write([]string{"Application", "Level", "Message", "Timestamp"})
		for _, log := range logs {
			writer.Write([]string{log.AppName, log.Level, log.Message, log.Timestamp.Format(time.RFC3339)})
		}
		writer.Flush()
		return
	}

	c.JSON(http.StatusOK, gin.H{"error": "pdf export not yet supported"})
}

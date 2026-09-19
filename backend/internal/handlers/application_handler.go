package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

type ApplicationHandler struct {
	DB *gorm.DB
}

type createAppReq struct {
	Name string `json:"name" binding:"required"`
}

// generateAPIKey returns 32 crypto/rand bytes, hex-encoded. API keys are
// bearer credentials, so they must not be guessable or reusable.
func generateAPIKey() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand failing is unrecoverable for a credential — refuse to
		// hand out a weak key rather than degrade silently.
		panic("crypto/rand unavailable: " + err.Error())
	}
	return time.Now().Format("20060102") + "_" + hex.EncodeToString(b)
}

func (h *ApplicationHandler) List(c *gin.Context) {
	var apps []models.Application
	if err := h.DB.Order("created_at desc").Find(&apps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, apps)
}

func (h *ApplicationHandler) Create(c *gin.Context) {
	var req createAppReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	app := models.Application{
		Name:    req.Name,
		APIKey:  generateAPIKey(),
		OwnerID: userID,
	}
	if err := h.DB.Create(&app).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create application"})
		return
	}

	recordAudit(h.DB, userID, "created_application", &app.ID, "Created application: "+app.Name)
	c.JSON(http.StatusCreated, app)
}

func (h *ApplicationHandler) Delete(c *gin.Context) {
	var app models.Application
	if err := h.DB.First(&app, c.Param("id")).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	userID, _ := currentUserID(c)
	if err := h.DB.Delete(&app).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
		return
	}
	recordAudit(h.DB, userID, "deleted_application", &app.ID, "Deleted application: "+app.Name)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

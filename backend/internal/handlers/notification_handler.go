package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

type NotificationHandler struct {
	DB *gorm.DB
}

type createNotificationReq struct {
	Title   string `json:"title" binding:"required"`
	Message string `json:"message" binding:"required"`
	Type    string `json:"type" binding:"required"` // alert, system, account
}

func (h *NotificationHandler) List(c *gin.Context) {
	userID, _ := currentUserID(c)
	unreadOnly := c.Query("unread") == "true"

	query := h.DB.Where("user_id = ?", userID)
	if unreadOnly {
		query = query.Where("read = ?", false)
	}

	var notifications []models.Notification
	if err := query.Order("created_at desc").Limit(50).Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, notifications)
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userID, _ := currentUserID(c)
	var notification models.Notification
	if err := h.DB.First(&notification, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		return
	}
	if notification.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	notification.Read = true
	h.DB.Save(&notification)
	c.JSON(http.StatusOK, notification)
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID, _ := currentUserID(c)
	h.DB.Model(&models.Notification{}).Where("user_id = ? AND read = ?", userID, false).Update("read", true)
	c.JSON(http.StatusOK, gin.H{"status": "all read"})
}

func (h *NotificationHandler) Create(c *gin.Context) {
	var req createNotificationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	notification := models.Notification{
		UserID:  userID,
		Title:   req.Title,
		Message: req.Message,
		Type:    req.Type,
	}
	if err := h.DB.Create(&notification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create notification"})
		return
	}
	c.JSON(http.StatusCreated, notification)
}

func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	userID, _ := currentUserID(c)
	var count int64
	h.DB.Model(&models.Notification{}).Where("user_id = ? AND read = ?", userID, false).Count(&count)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

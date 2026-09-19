package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

type DashboardHandler struct {
	DB *gorm.DB
}

type createDashboardReq struct {
	Name string `json:"name" binding:"required"`
}

type createWidgetReq struct {
	DashboardID uint   `json:"dashboard_id" binding:"required"`
	Type        string `json:"type" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Config      string `json:"config"`
	Position    int    `json:"position"`
}

func (h *DashboardHandler) List(c *gin.Context) {
	userID, _ := currentUserID(c)
	var dashboards []models.Dashboard
	if err := h.DB.Where("user_id = ?", userID).Order("updated_at desc").Find(&dashboards).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, dashboards)
}

func (h *DashboardHandler) Create(c *gin.Context) {
	var req createDashboardReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	dashboard := models.Dashboard{
		Name:   req.Name,
		UserID: userID,
	}
	if err := h.DB.Create(&dashboard).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create dashboard"})
		return
	}
	c.JSON(http.StatusCreated, dashboard)
}

func (h *DashboardHandler) Update(c *gin.Context) {
	userID, _ := currentUserID(c)
	var dashboard models.Dashboard
	if err := h.DB.First(&dashboard, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
		return
	}
	if dashboard.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var req createDashboardReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.Model(&dashboard).Updates(map[string]interface{}{
		"name":       req.Name,
		"updated_at": time.Now(),
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
		return
	}
	c.JSON(http.StatusOK, dashboard)
}

func (h *DashboardHandler) Delete(c *gin.Context) {
	userID, _ := currentUserID(c)
	var dashboard models.Dashboard
	if err := h.DB.First(&dashboard, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dashboard not found"})
		return
	}
	if dashboard.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	h.DB.Delete(&dashboard)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *DashboardHandler) AddWidget(c *gin.Context) {
	var req createWidgetReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	widget := models.DashboardWidget{
		DashboardID: req.DashboardID,
		Type:        req.Type,
		Title:       req.Title,
		Config:      req.Config,
		Position:    req.Position,
	}
	if widget.Position == 0 {
		widget.Position = 1
	}
	if err := h.DB.Create(&widget).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create widget"})
		return
	}
	c.JSON(http.StatusCreated, widget)
}

func (h *DashboardHandler) ListWidgets(c *gin.Context) {
	var widgets []models.DashboardWidget
	if err := h.DB.Where("dashboard_id = ?", c.Param("id")).Order("position asc").Find(&widgets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, widgets)
}

func (h *DashboardHandler) DeleteWidget(c *gin.Context) {
	var widget models.DashboardWidget
	if err := h.DB.First(&widget, c.Param("widget_id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "widget not found"})
		return
	}
	h.DB.Delete(&widget)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

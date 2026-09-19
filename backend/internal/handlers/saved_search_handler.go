package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

type SavedSearchHandler struct {
	DB *gorm.DB
}

type createSavedSearchReq struct {
	Name    string `json:"name" binding:"required"`
	Filters string `json:"filters" binding:"required"`
}

func (h *SavedSearchHandler) List(c *gin.Context) {
	userID, _ := currentUserID(c)
	var searches []models.SavedSearch
	if err := h.DB.Where("user_id = ?", userID).Order("updated_at desc").Find(&searches).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	c.JSON(http.StatusOK, searches)
}

func (h *SavedSearchHandler) Create(c *gin.Context) {
	var req createSavedSearchReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	search := models.SavedSearch{
		Name:    req.Name,
		Filters: req.Filters,
		UserID:  userID,
	}
	if err := h.DB.Create(&search).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create saved search"})
		return
	}
	c.JSON(http.StatusCreated, search)
}

func (h *SavedSearchHandler) Update(c *gin.Context) {
	userID, _ := currentUserID(c)
	var search models.SavedSearch
	if err := h.DB.First(&search, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "saved search not found"})
		return
	}
	if search.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var req createSavedSearchReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.DB.Model(&search).Updates(map[string]interface{}{
		"name":       req.Name,
		"filters":    req.Filters,
		"updated_at": time.Now(),
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
		return
	}
	c.JSON(http.StatusOK, search)
}

func (h *SavedSearchHandler) Delete(c *gin.Context) {
	userID, _ := currentUserID(c)
	var search models.SavedSearch
	if err := h.DB.First(&search, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "saved search not found"})
		return
	}
	if search.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	h.DB.Delete(&search)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

// APIKeyAuth extracts a Bearer token from the Authorization header and looks
// up the corresponding Application record. It sets the application on the
// context for downstream handlers.
func APIKeyAuth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing api key"})
			return
		}
		key := strings.TrimPrefix(header, "Bearer ")

		var app models.Application
		if err := db.Where("api_key = ?", key).First(&app).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}

		c.Set("applicationID", app.ID)
		c.Set("appName", app.Name)
		c.Next()
	}
}

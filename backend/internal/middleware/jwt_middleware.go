package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/auth"
	"logpulse/internal/models"
)

// JWTAuth verifies the bearer token and stores the caller's identity on the
// context for downstream handlers. dbConn, when non-nil, additionally
// enforces User.TokensInvalidBefore: password resets/changes stamp that
// column, which kills every previously issued JWT for the account without
// needing server-side session storage.
func JWTAuth(secret string, dbConn *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		claims, err := auth.ParseToken(secret, tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		if dbConn != nil && claims.IssuedAt != nil {
			var user models.User
			if err := dbConn.Select("id", "tokens_invalid_before").First(&user, claims.UserID).Error; err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "account no longer exists"})
				return
			}
			if user.TokensInvalidBefore != nil && !claims.IssuedAt.After(*user.TokensInvalidBefore) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "your session was invalidated — please sign in again"})
				return
			}
		}

		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// RequireRole restricts a route group to callers whose JWT role is one of
// the given roles. Must run after JWTAuth.
func RequireRole(roles ...models.Role) gin.HandlerFunc {
	allowed := make(map[models.Role]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}

	return func(c *gin.Context) {
		roleVal, ok := c.Get("role")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing role in token"})
			return
		}
		role, ok := roleVal.(models.Role)
		if !ok || !allowed[role] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "you don't have permission to do that"})
			return
		}
		c.Next()
	}
}

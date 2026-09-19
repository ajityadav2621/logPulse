package handlers

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

// recordAudit writes a best-effort audit entry. Failures are swallowed
// (never let audit logging break the primary request).
func recordAudit(db *gorm.DB, actorID uint, action string, targetID *uint, detail string) {
	_ = db.Create(&models.AuditLog{
		ActorID:  actorID,
		Action:   action,
		TargetID: targetID,
		Detail:   detail,
	}).Error
}

// currentUserID reads the authenticated caller's ID set by middleware.JWTAuth.
func currentUserID(c *gin.Context) (uint, bool) {
	v, ok := c.Get("userID")
	if !ok {
		return 0, false
	}
	id, ok := v.(uint)
	return id, ok
}

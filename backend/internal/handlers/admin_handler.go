package handlers

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/auth"
	"logpulse/internal/email"
	"logpulse/internal/models"
)

type AdminHandler struct {
	DB          *gorm.DB
	Emails      *email.Service
	FrontendURL string
}

// ListUsers handles GET /api/admin/users.
func (h *AdminHandler) ListUsers(c *gin.Context) {
	var users []models.User
	if err := h.DB.Order("created_at desc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load users"})
		return
	}

	out := make([]userResponse, 0, len(users))
	for _, u := range users {
		out = append(out, toUserResponse(u))
	}
	c.JSON(http.StatusOK, out)
}

type createUserReq struct {
	Name  string      `json:"name" binding:"required"`
	Email string      `json:"email" binding:"required,email"`
	Role  models.Role `json:"role" binding:"required"`
}

// CreateUser handles POST /api/admin/users. It provisions the account in
// "invited" status. The invite link is emailed to the user when SMTP is
// configured, and is also returned in the response so admins can share it
// themselves (or reach the user when email isn't set up).
func (h *AdminHandler) CreateUser(c *gin.Context) {
	var req createUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !req.Role.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be admin, editor, or viewer"})
		return
	}

	rawToken, hash, err := auth.GenerateInviteToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate invite"})
		return
	}
	expires := time.Now().Add(7 * 24 * time.Hour)

	actorID, _ := currentUserID(c)

	user := models.User{
		Name:               req.Name,
		Email:              req.Email,
		Role:               req.Role,
		Status:             models.StatusInvited,
		Provider:           models.ProviderLocal,
		InviteTokenHash:    hash,
		InviteTokenExpires: &expires,
		InvitedByID:        &actorID,
	}
	if err := h.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "a user with that email already exists"})
		return
	}

	recordAudit(h.DB, actorID, "invited_user", &user.ID, user.Email+" as "+string(user.Role))

	if h.Emails != nil {
		link := strings.TrimRight(h.FrontendURL, "/") + "/accept-invite?token=" + rawToken
		subject, html := email.UserInviteEmail(link)
		if err := h.Emails.SendAndRecord(models.EmailTypeUserInvite, user.Email, subject, html, &user.ID); err != nil {
			log.Printf("invite: could not queue email for user %d: %v", user.ID, err)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"user":        toUserResponse(user),
		"invite_link": "/accept-invite?token=" + rawToken,
	})
}

type updateRoleReq struct {
	Role models.Role `json:"role" binding:"required"`
}

// UpdateUserRole handles PATCH /api/admin/users/:id/role.
func (h *AdminHandler) UpdateUserRole(c *gin.Context) {
	var req updateRoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !req.Role.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role must be admin, editor, or viewer"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	h.DB.Model(&user).Update("role", req.Role)

	actorID, _ := currentUserID(c)
	recordAudit(h.DB, actorID, "changed_role", &user.ID, user.Email+" -> "+string(req.Role))

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// DeactivateUser handles POST /api/admin/users/:id/deactivate.
func (h *AdminHandler) DeactivateUser(c *gin.Context) {
	var user models.User
	if err := h.DB.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	actorID, _ := currentUserID(c)
	if user.ID == actorID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you can't deactivate your own account"})
		return
	}

	h.DB.Model(&user).Update("status", models.StatusDeactivated)
	recordAudit(h.DB, actorID, "deactivated_user", &user.ID, user.Email)

	c.JSON(http.StatusOK, gin.H{"status": "deactivated"})
}

// ReactivateUser handles POST /api/admin/users/:id/reactivate.
func (h *AdminHandler) ReactivateUser(c *gin.Context) {
	var user models.User
	if err := h.DB.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	h.DB.Model(&user).Update("status", models.StatusActive)

	actorID, _ := currentUserID(c)
	recordAudit(h.DB, actorID, "reactivated_user", &user.ID, user.Email)

	c.JSON(http.StatusOK, gin.H{"status": "active"})
}

// ListAuditLogs handles GET /api/admin/audit-logs.
func (h *AdminHandler) ListAuditLogs(c *gin.Context) {
	var logs []models.AuditLog
	if err := h.DB.Order("created_at desc").Limit(200).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load audit logs"})
		return
	}
	c.JSON(http.StatusOK, logs)
}

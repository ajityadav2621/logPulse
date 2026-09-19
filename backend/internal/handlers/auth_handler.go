package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"logpulse/internal/auth"
	"logpulse/internal/models"
)

type AuthHandler struct {
	DB        *gorm.DB
	JWTSecret string
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Login handles POST /api/auth/login — email/password sign-in.
// There is no public signup: accounts only exist once an admin invites them
// (see AdminHandler.CreateUser), so a missing user or unset password just
// looks like "invalid credentials" to avoid leaking who has an account.
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	switch user.Status {
	case models.StatusInvited:
		c.JSON(http.StatusForbidden, gin.H{"error": "you still need to accept your invite before signing in"})
		return
	case models.StatusDeactivated:
		c.JSON(http.StatusForbidden, gin.H{"error": "this account has been deactivated"})
		return
	}

	token, err := auth.GenerateToken(h.JWTSecret, &user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}

	now := time.Now()
	h.DB.Model(&user).Update("last_login_at", now)

	c.JSON(http.StatusOK, gin.H{"token": token, "user": toUserResponse(user)})
}

type acceptInviteReq struct {
	Token    string `json:"token" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

// AcceptInvite handles POST /api/auth/accept-invite. This is the only way a
// local-password account ever becomes usable: an admin creates the user
// (status "invited"), the invited person visits the link containing the raw
// token, sets their name and password, and the account flips to "active".
func (h *AuthHandler) AcceptInvite(c *gin.Context) {
	var req acceptInviteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash := auth.HashToken(req.Token)

	var user models.User
	if err := h.DB.Where("invite_token_hash = ? AND status = ?", hash, models.StatusInvited).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this invite link is invalid or has already been used"})
		return
	}

	if user.InviteTokenExpires == nil || time.Now().After(*user.InviteTokenExpires) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this invite link has expired — ask an admin to resend it"})
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not set password"})
		return
	}

	updates := map[string]interface{}{
		"name":                 req.Name,
		"password_hash":        passwordHash,
		"status":               models.StatusActive,
		"invite_token_hash":    "",
		"invite_token_expires": nil,
	}
	if err := h.DB.Model(&user).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not activate account"})
		return
	}
	user.Status = models.StatusActive

	token, err := auth.GenerateToken(h.JWTSecret, &user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}

	recordAudit(h.DB, user.ID, "accepted_invite", &user.ID, user.Email)
	c.JSON(http.StatusOK, gin.H{"token": token, "user": toUserResponse(user)})
}

// Me handles GET /api/auth/me — returns the authenticated caller's profile.
func (h *AuthHandler) Me(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, toUserResponse(user))
}

// userResponse is the safe, public shape of a User returned to clients.
// Keeping it explicit (rather than just returning the model) means adding
// a sensitive field to models.User later can't accidentally leak it.
type userResponse struct {
	ID          uint                `json:"id"`
	Name        string              `json:"name"`
	Email       string              `json:"email"`
	Role        models.Role         `json:"role"`
	Status      models.UserStatus   `json:"status"`
	Provider    models.AuthProvider `json:"provider"`
	AvatarURL   string              `json:"avatar_url"`
	LastLoginAt *time.Time          `json:"last_login_at"`
	CreatedAt   time.Time           `json:"created_at"`
}

func toUserResponse(u models.User) userResponse {
	return userResponse{
		ID:          u.ID,
		Name:        u.Name,
		Email:       u.Email,
		Role:        u.Role,
		Status:      u.Status,
		Provider:    u.Provider,
		AvatarURL:   u.AvatarURL,
		LastLoginAt: u.LastLoginAt,
		CreatedAt:   u.CreatedAt,
	}
}

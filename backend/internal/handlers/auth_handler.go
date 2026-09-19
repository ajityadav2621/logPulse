package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"logpulse/internal/auth"
	"logpulse/internal/email"
	"logpulse/internal/models"
)

const (
	resetTokenTTL = 30 * time.Minute
	// resetEmailCooldown throttles forgot-password requests per account so
	// the endpoint can't be used to bomb someone's inbox.
	resetEmailCooldown = time.Minute
	// dummyPasswordHash is compared against when a login/reset lookup finds
	// no user, so "user exists" can't be inferred from response timing.
	dummyPasswordHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
)

type AuthHandler struct {
	DB          *gorm.DB
	JWTSecret   string
	FrontendURL string
	Emails      *email.Service
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

type forgotPasswordReq struct {
	Email string `json:"email" binding:"required,email"`
}

// ForgotPassword handles POST /api/auth/forgot-password. The HTTP response
// is identical whether or not the address belongs to a real account — user
// enumeration happens over email, not over this endpoint.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req forgotPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "enter a valid email address"})
		return
	}

	var user models.User
	err := h.DB.Where("email = ?", strings.ToLower(strings.TrimSpace(req.Email))).First(&user).Error
	if err != nil {
		// Burn roughly the same time a real lookup+hash would take.
		_ = bcrypt.CompareHashAndPassword([]byte(dummyPasswordHash), []byte(req.Email))
		respondGenericReset(c)
		return
	}

	// Only accounts that actually sign in with a password can reset one.
	// OAuth-only users authenticate with their provider; still-invited
	// users don't have a password yet and need an invite, not a reset.
	if user.PasswordHash == "" || user.Status == models.StatusDeactivated {
		respondGenericReset(c)
		return
	}

	// Anti-bombing: an unused unexpired token already outstanding, or a
	// reset email sent very recently, means we silently do nothing more.
	var outstanding int64
	h.DB.Model(&models.PasswordResetToken{}).
		Where("user_id = ? AND used = ? AND expires_at > ?", user.ID, false, time.Now()).
		Count(&outstanding)
	var recent int64
	h.DB.Model(&models.EmailNotification{}).
		Where("related_user_id = ? AND type = ? AND created_at > ?", user.ID, models.EmailTypePasswordReset, time.Now().Add(-resetEmailCooldown)).
		Count(&recent)
	if outstanding == 0 && recent == 0 {
		h.sendPasswordResetEmail(&user)
	}

	respondGenericReset(c)
}

func (h *AuthHandler) sendPasswordResetEmail(user *models.User) {
	rawToken, hash, err := auth.GenerateInviteToken()
	if err != nil {
		log.Printf("password reset: could not generate token for user %d: %v", user.ID, err)
		return
	}

	expires := time.Now().Add(resetTokenTTL)
	token := models.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: expires,
	}
	if err := h.DB.Create(&token).Error; err != nil {
		log.Printf("password reset: could not store token for user %d: %v", user.ID, err)
		return
	}

	link := strings.TrimRight(h.FrontendURL, "/") + "/reset-password?token=" + rawToken
	subject, html := email.PasswordResetEmail(link, resetTokenTTL)
	if err := h.Emails.SendAndRecord(models.EmailTypePasswordReset, user.Email, subject, html, &user.ID); err != nil {
		log.Printf("password reset: could not queue email for user %d: %v", user.ID, err)
	}
	recordAudit(h.DB, user.ID, "requested_password_reset", &user.ID, user.Email)
}

func respondGenericReset(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "If an account exists for that email, we've sent a link to reset your password. It expires in 30 minutes.",
	})
}

type resetPasswordReq struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// ResetPassword handles POST /api/auth/reset-password. The raw token from
// the email link is validated against its stored hash, must be unused and
// unexpired, and is claimed atomically so two racing requests can't both
// succeed. Existing JWTs for the user are invalidated via tokens_invalid_before.
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req resetPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a reset token and a new password of at least 8 characters are required"})
		return
	}

	hash := auth.HashToken(req.Token)
	var token models.PasswordResetToken
	if err := h.DB.Where("token_hash = ?", hash).First(&token).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this reset link is invalid or has already been used"})
		return
	}
	if token.Used || time.Now().After(token.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this reset link has expired — request a new one"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, token.UserID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this reset link is no longer valid"})
		return
	}
	if user.Status == models.StatusDeactivated {
		c.JSON(http.StatusForbidden, gin.H{"error": "this account has been deactivated"})
		return
	}

	passwordHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not set password"})
		return
	}

	now := time.Now()
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		// Claim the token first: RowsAffected==0 means a concurrent request
		// already used it.
		res := tx.Model(&models.PasswordResetToken{}).
			Where("id = ? AND used = ?", token.ID, false).
			Update("used", true)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("reset token already used")
		}
		return tx.Model(&user).Updates(map[string]interface{}{
			"password_hash":         passwordHash,
			"tokens_invalid_before": now,
		}).Error
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "this reset link has already been used"})
		return
	}
	user.PasswordHash = passwordHash
	user.TokensInvalidBefore = &now

	// Hand back a fresh session so the person who just reset (typically on
	// their login screen) lands straight in the app.
	jwtToken, err := auth.GenerateToken(h.JWTSecret, &user)
	if err != nil {
		c.JSON(http.StatusPartialContent, gin.H{"message": "password updated — please sign in"})
		return
	}

	recordAudit(h.DB, user.ID, "reset_password", &user.ID, user.Email)
	c.JSON(http.StatusOK, gin.H{"token": jwtToken, "user": toUserResponse(user)})
}

type changePasswordReq struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// ChangePassword handles POST /api/auth/change-password (self-service). The
// current password is required; every JWT issued before "now" becomes
// invalid (so other devices are signed out), but a fresh token is returned
// so this session keeps working.
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req changePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "your current password and a new password of at least 8 characters are required"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// TODO: OAuth-only accounts currently can't set a local password here;
	// add a "set password" flow for them (email-verified) if ever needed.
	if user.PasswordHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "your account signs in with Google/GitHub and has no password to change"})
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.CurrentPassword) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "your current password is incorrect"})
		return
	}

	passwordHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not set password"})
		return
	}

	now := time.Now()
	if err := h.DB.Model(&user).Updates(map[string]interface{}{
		"password_hash":         passwordHash,
		"tokens_invalid_before": now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update password"})
		return
	}
	user.PasswordHash = passwordHash
	user.TokensInvalidBefore = &now

	jwtToken, err := auth.GenerateToken(h.JWTSecret, &user)
	if err != nil {
		c.JSON(http.StatusPartialContent, gin.H{"message": "password updated — please sign in again"})
		return
	}

	recordAudit(h.DB, user.ID, "changed_password", &user.ID, user.Email)
	c.JSON(http.StatusOK, gin.H{"token": jwtToken, "user": toUserResponse(user)})
}

type updateAccountReq struct {
	Name            *string `json:"name"`
	Email           *string `json:"email"`
	CurrentPassword string  `json:"current_password"`
}

// UpdateAccount handles PATCH /api/auth/account (self-service profile).
// Name-only changes need no password; changing the email address re-verifies
// the caller by requiring their current password — full email
// re-verification (confirmation link to the new address) is a TODO.
func (h *AuthHandler) UpdateAccount(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req updateAccountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == nil && req.Email == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nothing to update"})
		return
	}

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	updates := map[string]interface{}{}
	emailChanged := false
	if req.Email != nil {
		newEmail := strings.ToLower(strings.TrimSpace(*req.Email))
		if newEmail == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email can't be empty"})
			return
		}
		if newEmail != user.Email {
			// Email changes are sensitive — require re-authentication.
			if user.PasswordHash == "" || !auth.CheckPassword(user.PasswordHash, req.CurrentPassword) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "re-enter your current password to change your email"})
				return
			}
			var clash int64
			h.DB.Model(&models.User{}).Where("email = ? AND id <> ?", newEmail, user.ID).Count(&clash)
			if clash > 0 {
				c.JSON(http.StatusConflict, gin.H{"error": "another account already uses that email"})
				return
			}
			updates["email"] = newEmail
			updates["tokens_invalid_before"] = time.Now()
			emailChanged = true
		}
	}
	if req.Name != nil {
		newName := strings.TrimSpace(*req.Name)
		if newName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name can't be empty"})
			return
		}
		updates["name"] = newName
	}

	if len(updates) > 0 {
		if err := h.DB.Model(&user).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update account"})
			return
		}
		if err := h.DB.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reload account"})
			return
		}
		if emailChanged {
			recordAudit(h.DB, user.ID, "changed_email", &user.ID, "new: "+user.Email)
		}
		if _, nameSet := updates["name"]; nameSet {
			recordAudit(h.DB, user.ID, "changed_name", &user.ID, user.Name)
		}
	}

	// If the email changed, old JWTs (which embed the old email) are dead —
	// return a fresh one so this session survives.
	if emailChanged {
		jwtToken, err := auth.GenerateToken(h.JWTSecret, &user)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{"user": toUserResponse(user), "token": jwtToken})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"user": toUserResponse(user)})
}

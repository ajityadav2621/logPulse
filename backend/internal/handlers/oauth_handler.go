package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"gorm.io/gorm"

	"logpulse/internal/auth"
	"logpulse/internal/models"
)

const oauthStateCookie = "lp_oauth_state"

type OAuthHandler struct {
	DB           *gorm.DB
	JWTSecret    string
	FrontendURL  string
	GoogleConfig *oauth2.Config
	GitHubConfig *oauth2.Config
}

func randomState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// redirectWithError sends the browser back to the frontend login page with
// a human-readable error message the UI can surface.
func (h *OAuthHandler) redirectWithError(c *gin.Context, message string) {
	u, _ := url.Parse(h.FrontendURL + "/login")
	q := u.Query()
	q.Set("error", message)
	u.RawQuery = q.Encode()
	c.Redirect(http.StatusFound, u.String())
}

func (h *OAuthHandler) redirectWithToken(c *gin.Context, token string) {
	u, _ := url.Parse(h.FrontendURL + "/oauth-callback")
	q := u.Query()
	q.Set("token", token)
	u.RawQuery = q.Encode()
	c.Redirect(http.StatusFound, u.String())
}

// GoogleLogin handles GET /api/auth/google/login.
func (h *OAuthHandler) GoogleLogin(c *gin.Context) {
	state, err := randomState()
	if err != nil {
		h.redirectWithError(c, "could not start Google sign-in")
		return
	}
	c.SetCookie(oauthStateCookie, state, 600, "/", "", false, true)
	c.Redirect(http.StatusFound, h.GoogleConfig.AuthCodeURL(state, oauth2.AccessTypeOnline))
}

// GoogleCallback handles GET /api/auth/google/callback.
func (h *OAuthHandler) GoogleCallback(c *gin.Context) {
	h.handleCallback(c, h.GoogleConfig, models.ProviderGoogle, auth.FetchGoogleProfile)
}

// GitHubLogin handles GET /api/auth/github/login.
func (h *OAuthHandler) GitHubLogin(c *gin.Context) {
	state, err := randomState()
	if err != nil {
		h.redirectWithError(c, "could not start GitHub sign-in")
		return
	}
	c.SetCookie(oauthStateCookie, state, 600, "/", "", false, true)
	c.Redirect(http.StatusFound, h.GitHubConfig.AuthCodeURL(state))
}

// GitHubCallback handles GET /api/auth/github/callback.
func (h *OAuthHandler) GitHubCallback(c *gin.Context) {
	h.handleCallback(c, h.GitHubConfig, models.ProviderGitHub, auth.FetchGitHubProfile)
}

// handleCallback contains the shared logic for both providers: validate the
// CSRF state, exchange the code, fetch the profile, then either sign in an
// existing (admin-provisioned) user or reject with a clear error.
func (h *OAuthHandler) handleCallback(
	c *gin.Context,
	conf *oauth2.Config,
	provider models.AuthProvider,
	fetchProfile func(ctx context.Context, client *http.Client) (*auth.OAuthProfile, error),
) {
	stateCookie, err := c.Cookie(oauthStateCookie)
	c.SetCookie(oauthStateCookie, "", -1, "/", "", false, true)
	if err != nil || stateCookie == "" || stateCookie != c.Query("state") {
		h.redirectWithError(c, "sign-in request expired, please try again")
		return
	}

	code := c.Query("code")
	if code == "" {
		h.redirectWithError(c, "sign-in was cancelled")
		return
	}

	token, err := conf.Exchange(c, code)
	if err != nil {
		h.redirectWithError(c, "could not complete sign-in with the provider")
		return
	}

	client := conf.Client(c, token)
	profile, err := fetchProfile(c, client)
	if err != nil || profile.Email == "" {
		h.redirectWithError(c, "could not read your profile from the provider")
		return
	}

	var user models.User
	if err := h.DB.Where("email = ?", profile.Email).First(&user).Error; err != nil {
		h.redirectWithError(c, "no LogPulse account found for "+profile.Email+" — ask an admin to invite you")
		return
	}

	if user.Status == models.StatusDeactivated {
		h.redirectWithError(c, "this account has been deactivated")
		return
	}

	// Google/GitHub already verified this email address, so a pending
	// invite is satisfied by signing in this way — no separate
	// accept-invite step needed.
	updates := map[string]interface{}{
		"provider":    provider,
		"provider_id": profile.ProviderID,
		"status":      models.StatusActive,
	}
	if user.Name == "" {
		updates["name"] = profile.Name
	}
	if user.AvatarURL == "" {
		updates["avatar_url"] = profile.AvatarURL
	}
	h.DB.Model(&user).Updates(updates)

	user.Status = models.StatusActive
	now := time.Now()
	h.DB.Model(&user).Update("last_login_at", now)

	jwtToken, err := auth.GenerateToken(h.JWTSecret, &user)
	if err != nil {
		h.redirectWithError(c, "could not create session")
		return
	}

	recordAudit(h.DB, user.ID, "oauth_login", &user.ID, string(provider))
	h.redirectWithToken(c, jwtToken)
}

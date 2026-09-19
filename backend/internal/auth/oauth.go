package auth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"golang.org/x/oauth2"

	"logpulse/internal/config"
)

// OAuthProfile is the normalized shape we care about, regardless of provider.
type OAuthProfile struct {
	ProviderID string
	Email      string
	Name       string
	AvatarURL  string
}

func NewGoogleOAuthConfig(cfg *config.Config) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.GoogleRedirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://accounts.google.com/o/oauth2/auth",
			TokenURL: "https://oauth2.googleapis.com/token",
		},
	}
}

func NewGitHubOAuthConfig(cfg *config.Config) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     cfg.GitHubClientID,
		ClientSecret: cfg.GitHubClientSecret,
		RedirectURL:  cfg.GitHubRedirectURL,
		Scopes:       []string{"read:user", "user:email"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://github.com/login/oauth/authorize",
			TokenURL: "https://github.com/login/oauth/access_token",
		},
	}
}

func fetchJSON(ctx context.Context, client *http.Client, url string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return errors.New("oauth provider returned " + resp.Status + ": " + string(body))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// FetchGoogleProfile exchanges an authenticated client for the signed-in
// user's Google profile.
func FetchGoogleProfile(ctx context.Context, client *http.Client) (*OAuthProfile, error) {
	var raw struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := fetchJSON(ctx, client, "https://www.googleapis.com/oauth2/v2/userinfo", &raw); err != nil {
		return nil, err
	}
	if raw.Email == "" {
		return nil, errors.New("google account has no accessible email")
	}
	return &OAuthProfile{ProviderID: raw.ID, Email: raw.Email, Name: raw.Name, AvatarURL: raw.Picture}, nil
}

// FetchGitHubProfile exchanges an authenticated client for the signed-in
// user's GitHub profile. GitHub only returns a public email on /user if the
// user has made one public, so we fall back to /user/emails for the
// primary verified address.
func FetchGitHubProfile(ctx context.Context, client *http.Client) (*OAuthProfile, error) {
	var raw struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := fetchJSON(ctx, client, "https://api.github.com/user", &raw); err != nil {
		return nil, err
	}

	email := raw.Email
	if email == "" {
		var emails []struct {
			Email    string `json:"email"`
			Primary  bool   `json:"primary"`
			Verified bool   `json:"verified"`
		}
		if err := fetchJSON(ctx, client, "https://api.github.com/user/emails", &emails); err == nil {
			for _, e := range emails {
				if e.Primary && e.Verified {
					email = e.Email
					break
				}
			}
		}
	}
	if email == "" {
		return nil, errors.New("github account has no verified email")
	}

	name := raw.Name
	if name == "" {
		name = raw.Login
	}

	return &OAuthProfile{
		ProviderID: strconv.FormatInt(raw.ID, 10),
		Email:      email,
		Name:       name,
		AvatarURL:  raw.AvatarURL,
	}, nil
}

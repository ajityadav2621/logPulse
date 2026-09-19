package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port        string
	JWTSecret   string
	PostgresDSN string
	MongoURI    string
	MongoDBName string

	// FrontendURL is where the browser lands after an OAuth login
	// completes (e.g. http://localhost:5173/oauth-callback).
	FrontendURL string

	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	GitHubClientID     string
	GitHubClientSecret string
	GitHubRedirectURL  string

	// Bootstrap admin — created on first run if no users exist yet, since
	// there's no public signup and someone has to be able to log in to
	// invite everyone else. Name/email can be anything (a real person's
	// email works fine); nothing requires the value "admin".
	SeedAdminName     string
	SeedAdminEmail    string
	SeedAdminPassword string

	// SMTP settings for outbound email (password resets, invites).
	// Username/Password empty disables email sending — the pipeline then
	// records notification rows and logs bodies instead of delivering.
	// Port 465 uses implicit TLS; anything else (e.g. 587) uses STARTTLS.
	SMTPHost      string
	SMTPPort      string
	SMTPUsername  string
	SMTPPassword  string
	SMTPFromName  string
	EmailFromAddr string

	// Advanced monitoring.
	// AlertWebhookURL posts fired alerts to any JSON endpoint (Slack,
	// Discord, n8n, ...). Empty disables webhook delivery.
	AlertWebhookURL string
	// AnomalyInterval is the pause between background anomaly sweeps (AI-2).
	AnomalyInterval time.Duration
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret"),
		PostgresDSN: getEnv("POSTGRES_DSN", "host=localhost user=logpulse password=logpulse dbname=logpulse port=5432 sslmode=disable"),
		MongoURI:    getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDBName: getEnv("MONGO_DB", "logpulse"),

		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/auth/google/callback"),

		GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		GitHubRedirectURL:  getEnv("GITHUB_REDIRECT_URL", "http://localhost:8080/api/auth/github/callback"),

		SeedAdminName:     getEnv("SEED_ADMIN_NAME", "Admin"),
		SeedAdminEmail:    getEnv("SEED_ADMIN_EMAIL", "admin@logpulse.io"),
		SeedAdminPassword: getEnv("SEED_ADMIN_PASSWORD", "changeme123"),

		// Gmail with an App Password (2FA enabled on the account) is the
		// default sender; swap host/port/creds for SES/Resend/Mailgun.
		SMTPHost:      getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:      getEnv("SMTP_PORT", "587"),
		SMTPUsername:  getEnv("SMTP_USERNAME", ""),
		SMTPPassword:  getEnv("SMTP_PASSWORD", ""),
		SMTPFromName:  getEnv("SMTP_FROM_NAME", "LogPulse"),
		EmailFromAddr: getEnv("EMAIL_FROM_ADDRESS", "logpulse.notification@gmail.com"),

		AlertWebhookURL: getEnv("ALERT_WEBHOOK_URL", ""),
		AnomalyInterval: getEnvDuration("ANOMALY_INTERVAL_SECONDS", 120),
	}
}

func getEnvDuration(key string, fallbackSeconds int64) time.Duration {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			return time.Duration(n) * time.Second
		}
	}
	return time.Duration(fallbackSeconds) * time.Second
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

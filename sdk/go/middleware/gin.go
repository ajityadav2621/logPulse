package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/logpulse/logpulse-go"
)

// Gin returns a Gin middleware that logs every request to LogPulse.
// It captures method, path, status, latency, and any error returned
// by downstream handlers.
func Gin(client *logpulse.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		latency := time.Since(start)
		fields := map[string]interface{}{
			"method":   c.Request.Method,
			"path":     c.Request.URL.Path,
			"status":   c.Writer.Status(),
			"latency":  latency.String(),
			"client_ip": c.ClientIP(),
		}

		if len(c.Errors) > 0 {
			fields["error"] = c.Errors.Last().Error()
			client.Error("request failed", fields)
			return
		}

		level := logpulse.LevelInfo
		if c.Writer.Status() >= 500 {
			level = logpulse.LevelError
		} else if c.Writer.Status() >= 400 {
			level = logpulse.LevelWarn
		}

		client.Log(level, "request", fields)
	}
}

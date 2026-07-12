package config

import (
	"os"
)

type Config struct {
	Port         string
	JWTSecret    string
	PostgresDSN  string
	MongoURI     string
	MongoDBName  string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret"),
		PostgresDSN: getEnv("POSTGRES_DSN", "host=localhost user=logpulse password=logpulse dbname=logpulse port=5432 sslmode=disable"),
		MongoURI:    getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDBName: getEnv("MONGO_DB", "logpulse"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

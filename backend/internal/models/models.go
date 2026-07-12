package models

import "time"

// ---- Postgres models (structured data) ----

type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Email        string `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string `gorm:"not null" json:"-"`
	Role         string `gorm:"default:member" json:"role"` // admin | member
	CreatedAt    time.Time `json:"created_at"`
}

type Application struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"uniqueIndex;not null" json:"name"`
	APIKey    string    `gorm:"uniqueIndex;not null" json:"api_key"`
	OwnerID   uint      `json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
}

type AlertRule struct {
	ID            uint   `gorm:"primaryKey" json:"id"`
	ApplicationID uint   `json:"application_id"`
	Level         string `json:"level"`    // e.g. "error"
	Keyword       string `json:"keyword"`  // optional substring match
	Threshold     int    `json:"threshold"`// e.g. 5 occurrences
	WindowSeconds int    `json:"window_seconds"`
}

// ---- Mongo model (log documents) ----

type LogEntry struct {
	AppName   string    `bson:"app_name" json:"app_name"`
	Level     string    `bson:"level" json:"level"` // info | warn | error
	Message   string    `bson:"message" json:"message"`
	Meta      map[string]interface{} `bson:"meta,omitempty" json:"meta,omitempty"`
	Timestamp time.Time `bson:"timestamp" json:"timestamp"`
}

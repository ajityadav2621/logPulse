package db

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

func ConnectPostgres(dsn string) (*gorm.DB, error) {
	conn, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// AutoMigrate keeps this free/simple — no separate migration tool needed for MVP.
	if err := conn.AutoMigrate(&models.User{}, &models.Application{}, &models.AlertRule{}, &models.AlertEvent{}, &models.Incident{}, &models.AuditLog{}, &models.SavedSearch{}, &models.Dashboard{}, &models.DashboardWidget{}, &models.Report{}, &models.Notification{}); err != nil {
		return nil, err
	}

	return conn, nil
}

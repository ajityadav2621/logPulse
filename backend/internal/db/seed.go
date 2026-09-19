package db

import (
	"log"

	"gorm.io/gorm"

	"logpulse/internal/auth"
	"logpulse/internal/models"
)

// SeedAdmin creates the first admin account if the users table is empty.
// There's no public signup in LogPulse — every other account is created by
// an admin from the Users page — so without this, a fresh install would
// have no way to ever log in.
func SeedAdmin(dbConn *gorm.DB, name, email, password string) error {
	var count int64
	if err := dbConn.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	admin := models.User{
		Name:         name,
		Email:        email,
		PasswordHash: hash,
		Role:         models.RoleAdmin,
		Status:       models.StatusActive,
		Provider:     models.ProviderLocal,
	}
	if err := dbConn.Create(&admin).Error; err != nil {
		return err
	}

	log.Printf("seeded initial admin account: %s (change this password immediately)", email)
	return nil
}

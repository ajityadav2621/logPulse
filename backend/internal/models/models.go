package models

import "time"

// ---- Postgres models (structured data) ----

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

func (r Role) Valid() bool {
	switch r {
	case RoleAdmin, RoleEditor, RoleViewer:
		return true
	}
	return false
}

type UserStatus string

const (
	StatusInvited     UserStatus = "invited"
	StatusActive      UserStatus = "active"
	StatusDeactivated UserStatus = "deactivated"
)

// AuthProvider records how a user authenticates. A user can have a
// password AND a linked OAuth provider at the same time.
type AuthProvider string

const (
	ProviderLocal  AuthProvider = "local"
	ProviderGoogle AuthProvider = "google"
	ProviderGitHub AuthProvider = "github"
)

type User struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Name         string     `gorm:"not null" json:"name"`
	Email        string     `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string     `gorm:"column:password_hash" json:"-"`
	Role         Role       `gorm:"type:varchar(20);default:viewer;not null" json:"role"`
	Status       UserStatus `gorm:"type:varchar(20);default:invited;not null" json:"status"`

	// OAuth linkage. Provider/ProviderID are set once a user signs in via
	// Google or GitHub; a user can still also have a local password.
	Provider   AuthProvider `gorm:"type:varchar(20);default:local;not null" json:"provider"`
	ProviderID string       `json:"-"`
	AvatarURL  string       `json:"avatar_url"`

	// Invite flow: set when an admin creates the user, cleared once the
	// invite is accepted. InviteTokenHash stores a SHA-256 hash of the
	// token, never the raw token, so a DB leak doesn't hand out live invites.
	InviteTokenHash    string     `json:"-"`
	InviteTokenExpires *time.Time `json:"-"`
	InvitedByID        *uint      `json:"invited_by_id"`

	LastLoginAt *time.Time `json:"last_login_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
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
	Name          string `json:"name"`
	Level         string `json:"level"`     // e.g. "error"
	Keyword       string `json:"keyword"`   // optional substring match
	Threshold     int    `json:"threshold"` // e.g. 5 occurrences
	WindowSeconds int    `json:"window_seconds"`
	// CooldownSeconds is the triage window (AI-6): repeat breaches of the
	// same rule inside the cooldown are recorded as suppressed AlertEvents
	// instead of paging people again.
	CooldownSeconds int    `json:"cooldown_seconds"`
	Enabled         bool   `gorm:"default:true" json:"enabled"`
}

// AlertEvent records every breach of an alert rule — fired or suppressed —
// so the Alert History tab shows real trigger data and triage decisions.
type AlertEvent struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	RuleID        uint      `json:"rule_id"`
	AppName       string    `json:"app_name"`
	Level         string    `json:"level"`
	Keyword       string    `json:"keyword"`
	Count         int64     `json:"count"`
	Threshold     int       `json:"threshold"`
	WindowSeconds int       `json:"window_seconds"`
	Suppressed    bool      `json:"suppressed"` // deduplicated by cooldown triage
	IncidentID    *uint     `json:"incident_id"`
	CreatedAt     time.Time `json:"created_at"`
}

// Incident groups related failures — either declared manually or opened
// automatically by anomaly detection / cross-service correlation — with the
// evidence needed to reason about them.
type IncidentStatus string

const (
	IncidentOpen   IncidentStatus = "open"
	IncidentAck    IncidentStatus = "acknowledged"
	IncidentClosed IncidentStatus = "resolved"
)

type Incident struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"not null" json:"title"`
	Severity    string         `json:"severity"` // critical | error | warning | info
	Status      IncidentStatus `gorm:"type:varchar(20);default:open;not null" json:"status"`
	Source      string         `json:"source"` // anomaly | correlation | alert | manual
	Summary     string         `gorm:"type:text" json:"summary"`
	// Evidence, AffectedApps and AlertEventIDs are JSON-encoded arrays —
	// kept as text columns to avoid needing a JSONB migration path.
	Evidence      string     `gorm:"type:text" json:"evidence"`
	AffectedApps  string     `gorm:"type:text" json:"affected_apps"`
	AlertEventIDs string     `gorm:"type:text" json:"alert_event_ids"`
	StartedAt     time.Time  `json:"started_at"`
	ResolvedAt    *time.Time `json:"resolved_at"`
	CreatedByUserID *uint    `json:"created_by_user_id"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type SavedSearch struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Filters     string    `gorm:"type:text" json:"filters"` // JSON blob of filter params
	UserID      uint      `json:"user_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Dashboard struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	UserID    uint      `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type DashboardWidget struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	DashboardID  uint      `json:"dashboard_id"`
	Type         string    `json:"type"` // stat, chart, log_stream
	Title        string    `json:"title"`
	Config       string    `gorm:"type:text" json:"config"` // JSON blob
	Position     int       `json:"position"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Report struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Type        string    `json:"type"` // daily, weekly, monthly, custom
	Format      string    `json:"format"` // csv, pdf
	Filters     string    `gorm:"type:text" json:"filters"`
	UserID      uint      `json:"user_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Notification struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Type      string    `json:"type"` // alert, system, account
	Read      bool      `gorm:"default:false" json:"read"`
	CreatedAt time.Time `json:"created_at"`
}

// AuditLog records sensitive account actions (role changes, deactivation,
// invites) for the Audit Logs tab in User Management.
type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ActorID   uint      `json:"actor_id"`
	Action    string    `json:"action"`
	TargetID  *uint     `json:"target_id"`
	Detail    string    `json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}

// ---- Mongo model (log documents) ----

type LogEntry struct {
	ID        string                 `bson:"_id,omitempty" json:"id"`
	AppName   string                 `bson:"app_name" json:"app_name"`
	Level     string                 `bson:"level" json:"level"` // info | warn | error
	Message   string                 `bson:"message" json:"message"`
	Meta      map[string]interface{} `bson:"meta,omitempty" json:"meta,omitempty"`
	Timestamp time.Time              `bson:"timestamp" json:"timestamp"`

	// PatternHash fingerprints the message with variable parts (numbers,
	// UUIDs, IPs, quoted strings) normalized away — AI-1 clustering groups
	// on this so 10k near-duplicate lines collapse into one pattern row.
	PatternHash string `bson:"pattern_hash,omitempty" json:"pattern_hash,omitempty"`
	Pattern     string `bson:"pattern,omitempty" json:"pattern,omitempty"`
}

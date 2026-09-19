package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

// Detector learns each application's normal log-volume and error-rate
// baseline and flags statistically unusual behaviour (AI-2). Findings are
// grouped across applications in the same evaluation window into incidents
// (AI-4 correlation), recorded as AlertEvent-linked evidence (AI-6), and
// pushed to admins as in-app notifications.

type AnomalyKind string

const (
	AnomalySpike     AnomalyKind = "volume_spike"
	AnomalyDrop      AnomalyKind = "volume_drop"
	AnomalyErrorRate AnomalyKind = "error_rate"
)

type AnomalyResult struct {
	AppName   string      `json:"app_name"`
	Kind      AnomalyKind `json:"kind"`
	Score     float64     `json:"score"` // z-score
	Observed  float64     `json:"observed"`
	Expected  float64     `json:"expected"`
	Message   string      `json:"message"`
	Severity  string      `json:"severity"` // critical | error | warning
	DetectedAt time.Time  `json:"detected_at"`
}

type Detector struct {
	Agg *Aggregator
	DB  *gorm.DB

	// Interval between automatic sweeps. Defaults to 2 minutes.
	Interval time.Duration
}

// appStats holds one application's week of per-hour counts, keyed by
// hour-of-day for baseline comparison, plus the observation window
// (the last complete hour) and the newest bucket seen.
type appStats struct {
	hourly        map[string][]float64 // "15" -> the 7 daily counts for hour 15
	hourlyErrs    map[string][]float64
	totalHours    []float64
	totalErrs     []float64
	lastHourTotal int64
	lastHourErrs  int64
	lastSeen      time.Time
}

// ---- statistics helpers ----

func mean(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	s := 0.0
	for _, x := range xs {
		s += x
	}
	return s / float64(len(xs))
}

func stdDev(xs []float64, m float64) float64 {
	if len(xs) < 2 {
		return 0
	}
	s := 0.0
	for _, x := range xs {
		s += (x - m) * (x - m)
	}
	return math.Sqrt(s / float64(len(xs)-1))
}

// Detect sweeps every application that logged recently and returns the
// anomalies found: the last COMPLETE hour is compared against the same
// hour-of-day across the past week (so daily rhythm doesn't cause false
// alarms), and a precise raw 15-minute count catches silent services.
// Pure read+compute — persisting incidents is UpsertAnomalyIncidents' job.
func (d *Detector) Detect(ctx context.Context) ([]AnomalyResult, error) {
	now := time.Now()
	baselineStart := now.Add(-7 * 24 * time.Hour)
	lastHourStart := now.Truncate(time.Hour).Add(-time.Hour)
	dropSince := now.Add(-15 * time.Minute)

	// per-app per-hour counts over the baseline week
	pipeline := appWindowPipeline(baselineStart, now)
	cursor, err := d.Agg.Collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	apps := map[string]*appStats{}

	for cursor.Next(ctx) {
		var row struct {
			App    string `bson:"app"`
			Total  int64  `bson:"total"`
			Errs   int64  `bson:"errors"`
			Bucket string `bson:"bucket"` // "%Y-%m-%dT%H:00:00Z" — $dateTruncate is not available on every server build
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		bucketTime, err := time.Parse("2006-01-02T15:04:00Z", row.Bucket)
		if err != nil {
			continue
		}
		s, ok := apps[row.App]
		if !ok {
			s = &appStats{hourly: map[string][]float64{}, hourlyErrs: map[string][]float64{}}
			apps[row.App] = s
		}
		if bucketTime.Equal(lastHourStart) {
			// The observation window: the last complete hour.
			s.lastHourTotal = row.Total
			s.lastHourErrs = row.Errs
			continue
		}
		if bucketTime.After(lastHourStart) {
			// The in-progress hour is incomplete — never score it against
			// complete-hour baselines; it only tells us the app is alive.
			if bucketTime.After(s.lastSeen) {
				s.lastSeen = bucketTime
			}
			continue
		}
		key := bucketTime.Format("15")
		s.hourly[key] = append(s.hourly[key], float64(row.Total))
		s.hourlyErrs[key] = append(s.hourlyErrs[key], float64(row.Errs))
		s.totalHours = append(s.totalHours, float64(row.Total))
		s.totalErrs = append(s.totalErrs, float64(row.Errs))
		if bucketTime.After(s.lastSeen) {
			s.lastSeen = bucketTime
		}
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}

	results := []AnomalyResult{}
	for name, s := range apps {
		// Need at least 12 hours of history before baselines mean anything.
		if len(s.totalHours) < 12 {
			continue
		}
		hourKey := lastHourStart.Format("15")
		profile := s.hourly[hourKey]

		meanH := mean(s.totalHours)
		stdH := stdDev(s.totalHours, meanH)

		// 1) Volume anomaly: last complete hour vs same hour-of-day.
		if len(profile) >= 3 {
			expected := mean(profile)
			// Regularize: a handful of same-hour samples give noisy stds.
			std := math.Max(stdDev(profile, expected), math.Max(expected*0.3, 1))
			observed := float64(s.lastHourTotal)

			res, ok := checkVolume(name, observed, expected, std)
			if ok {
				results = append(results, res)
			}
		}

		// 2) Error-rate anomaly: last complete hour vs pooled weekly rate.
		if len(profile) >= 3 {
			baseTotal, baseErrs := 0.0, 0.0
			for i, v := range s.totalHours {
				baseTotal += v
				baseErrs += s.totalErrs[i]
			}
			res, ok := checkErrorRate(name, float64(s.lastHourTotal), float64(s.lastHourErrs), baseTotal, baseErrs)
			if ok {
				results = append(results, res)
			}
		}

		// 3) Silence: a service whose baseline predicts real traffic but
		// sent nothing in the last 15 minutes is likely down.
		expected15 := meanH / 4.0
		if expected15 >= 20 && now.Sub(s.lastSeen) > 20*time.Minute {
			recent, err := d.Agg.Collection.CountDocuments(ctx, bson.M{
				"app_name":  name,
				"timestamp": bson.M{"$gte": dropSince},
			})
			if err == nil && recent == 0 {
				results = append(results, AnomalyResult{
					AppName: name, Kind: AnomalyDrop, Score: round2(expected15 / math.Max(stdH, 1)),
					Observed: 0, Expected: round2(expected15),
					Severity:   "warning",
					Message:    fmt.Sprintf("No logs from %q in the last 15 minutes (expected ~%.0f) — the service may be down.", name, expected15),
					DetectedAt: now,
				})
			}
		}
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].AppName != results[j].AppName {
			return results[i].AppName < results[j].AppName
		}
		return results[i].Score > results[j].Score
	})
	return results, nil
}

func checkVolume(name string, observed, expected, std float64) (AnomalyResult, bool) {
	z := (observed - expected) / std
	if z >= 3.0 && observed >= math.Max(5, expected*2) {
		sev := "error"
		if z >= 6 {
			sev = "critical"
		}
		return AnomalyResult{
			AppName: name, Kind: AnomalySpike, Score: round2(z),
			Observed: observed, Expected: round2(expected),
			Severity: sev,
			Message: fmt.Sprintf("Log volume for %q hit %.0f last hour (typical %.0f for this hour of day, z=%.1f).",
				name, observed, expected, z),
			DetectedAt: time.Now(),
		}, true
	}
	return AnomalyResult{}, false
}

func checkErrorRate(name string, obsTotal, obsErrs, baseTotal, baseErrs float64) (AnomalyResult, bool) {
	if baseTotal < 50 || obsTotal < 20 {
		return AnomalyResult{}, false
	}
	p := baseErrs / baseTotal
	rate := obsErrs / obsTotal
	// Wald z-test against the baseline error rate.
	se := math.Sqrt(p * (1 - p) / obsTotal)
	if se == 0 {
		return AnomalyResult{}, false
	}
	z := (rate - p) / se
	if z >= 3.0 && obsErrs >= 5 {
		sev := "error"
		if z >= 6 {
			sev = "critical"
		}
		return AnomalyResult{
			AppName: name, Kind: AnomalyErrorRate, Score: round2(z),
			Observed: rate, Expected: round2(p),
			Severity: sev,
			Message: fmt.Sprintf("Error rate for %q was %.1f%% last hour (baseline %.1f%%, z=%.1f).",
				name, rate*100, p*100, z),
			DetectedAt: time.Now(),
		}, true
	}
	return AnomalyResult{}, false
}

func appWindowPipeline(baselineStart, now time.Time) mongo.Pipeline {
	return mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"timestamp": bson.M{"$gte": baselineStart, "$lte": now}}}},
		{{Key: "$group", Value: bson.M{
			"_id":    "$app_name",
			"counts": bson.M{"$push": bson.M{
				"bucket":  bson.M{"$dateToString": bson.M{"format": "%Y-%m-%dT%H:00:00Z", "date": "$timestamp"}},
				"total":   1,
				"isError": bson.M{"$cond": bson.A{bson.M{"$in": bson.A{"$level", bson.A{"error", "critical"}}}, 1, 0}},
			}},
		}}},
		{{Key: "$unwind", Value: "$counts"}},
		{{Key: "$group", Value: bson.M{
			"_id":    bson.M{"app": "$_id", "bucket": "$counts.bucket"},
			"total":  bson.M{"$sum": "$counts.total"},
			"errors": bson.M{"$sum": "$counts.isError"},
		}}},
		{{Key: "$project", Value: bson.M{
			"_id":    0,
			"app":    "$_id.app",
			"bucket": "$_id.bucket",
			"total":  1,
			"errors": 1,
		}}},
	}
}

func round2(f float64) float64 { return math.Round(f*100) / 100 }

// ---- persistence: incidents (AI-4 correlation) ----

// UpsertAnomalyIncidents turns detection results into incidents. Multiple
// apps flagged in the same sweep are correlated into ONE incident when a
// shared root cause is plausible (same sweep + overlapping kinds), per AI-4.
// Existing open incidents for the same apps within the dedup window are
// updated instead of duplicated, and unresolved alert events get linked in
// (AI-6 triage).
func (d *Detector) UpsertAnomalyIncidents(ctx context.Context, results []AnomalyResult) ([]models.Incident, error) {
	if len(results) == 0 {
		return nil, nil
	}
	const dedupWindow = 30 * time.Minute
	now := time.Now()

	// Split into per-app anomalies and correlations (2+ apps this sweep).
	byApp := map[string][]AnomalyResult{}
	for _, r := range results {
		byApp[r.AppName] = append(byApp[r.AppName], r)
	}

	created := []models.Incident{}
	if len(byApp) >= 2 {
		inc, err := d.correlateIncident(ctx, results, now)
		if err != nil {
			return nil, err
		}
		if inc != nil {
			created = append(created, *inc)
		}
		return created, nil
	}

	for app, rs := range byApp {
		inc, err := d.upsertAppIncident(ctx, app, rs, dedupWindow, now)
		if err != nil {
			return created, err
		}
		if inc != nil {
			created = append(created, *inc)
		}
	}
	return created, nil
}

func (d *Detector) upsertAppIncident(ctx context.Context, app string, rs []AnomalyResult, dedupWindow time.Duration, now time.Time) (*models.Incident, error) {
	// Reuse an open anomaly incident for this app if one is recent enough.
	var inc models.Incident
	err := d.DB.Where(
		"status IN ? AND source IN ? AND affected_apps LIKE ? AND started_at > ?",
		[]models.IncidentStatus{models.IncidentOpen, models.IncidentAck},
		[]string{"anomaly", "correlation"},
		"%\""+app+"\"%",
		now.Add(-dedupWindow),
	).Order("created_at desc").First(&inc).Error

	if err == nil {
		// Update the existing incident: bump severity if worse, extend window.
		worst := worstSeverity(rs)
		updates := map[string]interface{}{"updated_at": now}
		if severityRank(worst) > severityRank(inc.Severity) {
			updates["severity"] = worst
		}
		if err := d.DB.Model(&inc).Updates(updates).Error; err != nil {
			return nil, err
		}
		d.linkAlertEvents(&inc, []string{app}, now)
		d.notifyIncident(inc, "updated")
		return &inc, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	inc = models.Incident{
		Title:   incidentTitle(rs, []string{app}),
		Severity: worstSeverity(rs),
		Status:  models.IncidentOpen,
		Source:  "anomaly",
		Summary: summarize(rs),
		AffectedApps: mustJSON([]string{app}),
		StartedAt: now.Add(-15 * time.Minute),
	}
	if err := d.DB.Create(&inc).Error; err != nil {
		return nil, err
	}
	d.linkAlertEvents(&inc, []string{app}, now)
	d.notifyIncident(inc, "opened")
	return &inc, nil
}

func (d *Detector) correlateIncident(ctx context.Context, results []AnomalyResult, now time.Time) (*models.Incident, error) {
	appsSet := map[string]bool{}
	for _, r := range results {
		appsSet[r.AppName] = true
	}
	apps := make([]string, 0, len(appsSet))
	for a := range appsSet {
		apps = append(apps, a)
	}
	sort.Strings(apps)

	// Dedup: reuse an open correlation incident seen in the last 30 minutes
	// instead of opening a new one every sweep (AI-6 noise reduction).
	const dedupWindow = 30 * time.Minute
	var inc models.Incident
	err := d.DB.Where(
		"status IN ? AND source = ? AND started_at > ?",
		[]models.IncidentStatus{models.IncidentOpen, models.IncidentAck},
		"correlation",
		now.Add(-dedupWindow),
	).Order("created_at desc").First(&inc).Error

	if err == nil {
		updates := map[string]interface{}{"updated_at": now}
		if w := worstSeverity(results); severityRank(w) > severityRank(inc.Severity) {
			updates["severity"] = w
		}
		if err := d.DB.Model(&inc).Updates(updates).Error; err != nil {
			return nil, err
		}
		d.linkAlertEvents(&inc, apps, now)
		return &inc, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	inc = models.Incident{
		Title:   fmt.Sprintf("Cross-service anomaly burst across %d services", len(apps)),
		Severity: worstSeverity(results),
		Status:  models.IncidentOpen,
		Source:  "correlation",
		Summary: fmt.Sprintf("%d services reported anomalies in the same window, suggesting a shared root cause. %s",
			len(apps), summarize(results)),
		AffectedApps: mustJSON(apps),
		StartedAt: now.Add(-15 * time.Minute),
	}
	if err := d.DB.Create(&inc).Error; err != nil {
		return nil, err
	}
	d.linkAlertEvents(&inc, apps, now)
	d.notifyIncident(inc, "opened")
	return &inc, nil
}

// linkAlertEvents attaches recent unresolved alert events for the affected
// apps to this incident and marks suppressed ones, so on-call sees one story
// instead of N pages (AI-6).
func (d *Detector) linkAlertEvents(inc *models.Incident, apps []string, now time.Time) {
	var events []models.AlertEvent
	if err := d.DB.Where(
		"app_name IN ? AND incident_id IS NULL AND created_at > ?",
		apps, now.Add(-30*time.Minute),
	).Order("created_at desc").Limit(50).Find(&events).Error; err != nil || len(events) == 0 {
		return
	}
	ids := make([]uint, 0, len(events))
	for _, e := range events {
		ids = append(ids, e.ID)
	}
	d.DB.Model(&models.AlertEvent{}).Where("id IN ?", ids).Update("incident_id", inc.ID)
	if inc.AlertEventIDs == "" {
		d.DB.Model(inc).Update("alert_event_ids", mustJSON(ids))
	}
}

func (d *Detector) notifyIncident(inc models.Incident, action string) {
	var admins []models.User
	if err := d.DB.Where("role = ?", models.RoleAdmin).Find(&admins).Error; err != nil {
		return
	}
	verb := "opened"
	if action == "updated" {
		verb = "still active"
	}
	title := fmt.Sprintf("Incident %s: %s", verb, inc.Title)
	msg := inc.Summary
	if len(msg) > 400 {
		msg = msg[:400]
	}
	for _, admin := range admins {
		d.DB.Create(&models.Notification{
			UserID:  admin.ID,
			Title:   title,
			Message: msg,
			Type:    "incident",
		})
	}
	log.Printf("[MONITOR] incident %s (%s): %s", verb, inc.Severity, inc.Title)
}

func incidentTitle(rs []AnomalyResult, apps []string) string {
	if len(rs) == 1 {
		switch rs[0].Kind {
		case AnomalySpike:
			return "Log volume spike in " + apps[0]
		case AnomalyDrop:
			return "Log volume drop in " + apps[0]
		case AnomalyErrorRate:
			return "Error rate spike in " + apps[0]
		}
	}
	return fmt.Sprintf("Anomalies detected in %s", apps[0])
}

func worstSeverity(rs []AnomalyResult) string {
	worst := "warning"
	for _, r := range rs {
		if severityRank(r.Severity) > severityRank(worst) {
			worst = r.Severity
		}
	}
	return worst
}

func severityRank(s string) int {
	switch s {
	case "critical":
		return 4
	case "error":
		return 3
	case "warning":
		return 2
	default:
		return 1
	}
}

func summarize(rs []AnomalyResult) string {
	msgs := make([]string, 0, len(rs))
	for _, r := range rs {
		msgs = append(msgs, r.Message)
	}
	out := ""
	for i, m := range msgs {
		if i > 0 {
			out += " "
		}
		out += m
		if len(out) > 500 {
			break
		}
	}
	return out
}

func mustJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}

// Run starts the periodic detection loop. It logs failures and keeps going —
// a failed sweep must never take down the API.
func (d *Detector) Run(ctx context.Context) {
	interval := d.Interval
	if interval <= 0 {
		interval = 2 * time.Minute
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				func() {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("[MONITOR] detector panic recovered: %v", r)
						}
					}()
					sweepCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
					defer cancel()
					results, err := d.Detect(sweepCtx)
					if err != nil {
						log.Printf("[MONITOR] anomaly sweep failed: %v", err)
						return
					}
					if _, err := d.UpsertAnomalyIncidents(sweepCtx, results); err != nil {
						log.Printf("[MONITOR] incident upsert failed: %v", err)
					}
				}()
			}
		}
	}()
}

package monitor

import (
	"context"
	"fmt"
	"sort"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Aggregate wraps the logs collection with the read-side queries used by the
// dashboard, analytics, detector, and copilot. Everything here is a plain
// Mongo aggregation — no extra infrastructure needed.

type Aggregator struct {
	Collection *mongo.Collection
}

// ---- Timeseries (dashboard + analytics) ----

type BucketPoint struct {
	Bucket    string  `json:"bucket"` // RFC3339 (UTC)
	Total     int64   `json:"total"`
	Critical  int64   `json:"critical"`
	Error     int64   `json:"error"`
	Warning   int64   `json:"warning"`
	Info      int64   `json:"info"`
	Debug     int64   `json:"debug"`
	ErrorRate float64 `json:"error_rate"`
}

// Timeseries returns fixed-width buckets between since and now, merging
// per-minute Mongo groups into the requested bucket size in Go (works on any
// MongoDB version, no $dateTruncate required).
func (a *Aggregator) Timeseries(ctx context.Context, app string, since, until time.Time, bucket time.Duration) ([]BucketPoint, error) {
	match := bson.M{"timestamp": bson.M{"$gte": since, "$lte": until}}
	if app != "" {
		match["app_name"] = app
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$group", Value: bson.M{
			"_id": bson.M{
				"minute": bson.M{"$dateToString": bson.M{"format": "%Y-%m-%dT%H:%M:00Z", "date": "$timestamp"}},
				"level":  "$level",
			},
			"count": bson.M{"$sum": 1},
		}}},
	}

	cursor, err := a.Collection.Aggregate(ctx, pipeline, options.Aggregate().SetAllowDiskUse(true))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	// minute -> level -> count
	perMinute := map[string]map[string]int64{}
	for cursor.Next(ctx) {
		var row struct {
			ID struct {
				Minute string `bson:"minute"`
				Level  string `bson:"level"`
			} `bson:"_id"`
			Count int64 `bson:"count"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		lv, ok := perMinute[row.ID.Minute]
		if !ok {
			lv = map[string]int64{}
			perMinute[row.ID.Minute] = lv
		}
		lv[row.ID.Level] += row.Count
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}

	// Build zero-filled buckets so charts have a continuous axis.
	bucketMs := int64(bucket / time.Millisecond)
	type acc struct {
		levels map[string]int64
		total  int64
	}
	buckets := map[int64]*acc{}
	start := since.Truncate(bucket)
	for t := start; !t.After(until); t = t.Add(bucket) {
		buckets[t.UnixMilli()/bucketMs*bucketMs] = &acc{levels: map[string]int64{}}
	}

	for minute, levels := range perMinute {
		t, err := time.Parse("2006-01-02T15:04:00Z", minute)
		if err != nil {
			continue
		}
		key := t.UnixMilli()/bucketMs*bucketMs
		b, ok := buckets[key]
		if !ok {
			b = &acc{levels: map[string]int64{}}
			buckets[key] = b
		}
		for level, n := range levels {
			b.levels[level] += n
			b.total += n
		}
	}

	keys := make([]int64, 0, len(buckets))
	for k := range buckets {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	out := make([]BucketPoint, 0, len(keys))
	for _, k := range keys {
		b := buckets[k]
		errs := b.levels["error"] + b.levels["critical"]
		rate := 0.0
		if b.total > 0 {
			rate = float64(errs) / float64(b.total)
		}
		out = append(out, BucketPoint{
			Bucket:    time.UnixMilli(k).UTC().Format(time.RFC3339),
			Total:     b.total,
			Critical:  b.levels["critical"],
			Error:     b.levels["error"],
			Warning:   b.levels["warning"],
			Info:      b.levels["info"],
			Debug:     b.levels["debug"],
			ErrorRate: rate,
		})
	}
	return out, nil
}

// ---- Top apps ----

type TopApp struct {
	AppName string  `json:"app_name"`
	Total   int64   `json:"total"`
	Errors  int64   `json:"errors"`
	ErrorRate float64 `json:"error_rate"`
}

func (a *Aggregator) TopApps(ctx context.Context, since time.Time, limit int64) ([]TopApp, error) {
	if limit <= 0 {
		limit = 8
	}
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"timestamp": bson.M{"$gte": since}}}},
		{{Key: "$group", Value: bson.M{
			"_id":    "$app_name",
			"total":  bson.M{"$sum": 1},
			"errors": bson.M{"$sum": bson.M{
				"$cond": bson.A{bson.M{"$in": bson.A{"$level", bson.A{"error", "critical"}}}, 1, 0},
			}},
		}}},
		{{Key: "$sort", Value: bson.M{"total": -1}}},
		{{Key: "$limit", Value: limit}},
	}
	cursor, err := a.Collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var out []TopApp
	for cursor.Next(ctx) {
		var row struct {
			ID     string `bson:"_id"`
			Total  int64  `bson:"total"`
			Errors int64  `bson:"errors"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		rate := 0.0
		if row.Total > 0 {
			rate = float64(row.Errors) / float64(row.Total)
		}
		out = append(out, TopApp{AppName: row.ID, Total: row.Total, Errors: row.Errors, ErrorRate: rate})
	}
	return out, cursor.Err()
}

// ---- Clusters (AI-1) ----

type Cluster struct {
	PatternHash string    `json:"pattern_hash"`
	Pattern     string    `json:"pattern"`
	Sample      string    `json:"sample_message"`
	Count       int64     `json:"count"`
	Level       string    `json:"level"`
	Apps        []string  `json:"apps"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
}

// Clusters groups near-duplicate log lines over a time range, largest first.
// minCount=1 returns every pattern; pass 2+ to see only repeated noise.
func (a *Aggregator) Clusters(ctx context.Context, app, level string, since time.Time, minCount, limit int64) ([]Cluster, error) {
	if limit <= 0 {
		limit = 50
	}
	match := bson.M{
		"timestamp":    bson.M{"$gte": since},
		"pattern_hash": bson.M{"$exists": true, "$ne": ""},
	}
	if app != "" {
		match["app_name"] = app
	}
	if level != "" {
		match["level"] = level
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$group", Value: bson.M{
			"_id":        "$pattern_hash",
			"pattern":    bson.M{"$first": "$pattern"},
			"sample":     bson.M{"$first": "$message"},
			"count":      bson.M{"$sum": 1},
			"apps":       bson.M{"$addToSet": "$app_name"},
			"first_seen": bson.M{"$min": "$timestamp"},
			"last_seen":  bson.M{"$max": "$timestamp"},
			// rank a cluster by its worst level so mixed groups surface as errors
			"score": bson.M{"$max": bson.M{"$switch": bson.M{
				"branches": bson.A{
					bson.M{"case": bson.M{"$eq": bson.A{"$level", "critical"}}, "then": 4},
					bson.M{"case": bson.M{"$eq": bson.A{"$level", "error"}}, "then": 3},
					bson.M{"case": bson.M{"$eq": bson.A{"$level", "warning"}}, "then": 2},
				},
				"default": 1,
			}}},
			"levels": bson.M{"$push": "$level"},
		}}},
		{{Key: "$match", Value: bson.M{"count": bson.M{"$gte": minCount}}}},
		{{Key: "$sort", Value: bson.M{"score": -1, "count": -1}}},
		{{Key: "$limit", Value: limit}},
	}
	cursor, err := a.Collection.Aggregate(ctx, pipeline, options.Aggregate().SetAllowDiskUse(true))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var out []Cluster
	for cursor.Next(ctx) {
		var row struct {
			ID        string   `bson:"_id"`
			Pattern   string   `bson:"pattern"`
			Sample    string   `bson:"sample"`
			Count     int64    `bson:"count"`
			Apps      []string `bson:"apps"`
			FirstSeen time.Time `bson:"first_seen"`
			LastSeen  time.Time `bson:"last_seen"`
			Levels    []string `bson:"levels"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		out = append(out, Cluster{
			PatternHash: row.ID,
			Pattern:     row.Pattern,
			Sample:      row.Sample,
			Count:       row.Count,
			Level:       worstLevel(row.Levels),
			Apps:        row.Apps,
			FirstSeen:   row.FirstSeen,
			LastSeen:    row.LastSeen,
		})
	}
	return out, cursor.Err()
}

func worstLevel(levels []string) string {
	worst := "debug"
	rank := map[string]int{"debug": 1, "info": 2, "warning": 3, "error": 4, "critical": 5}
	for _, l := range levels {
		if rank[l] > rank[worst] {
			worst = l
		}
	}
	return worst
}

// ---- Per-app health (Servers page + detector prefilter) ----

type AppHealth struct {
	AppName    string    `json:"app_name"`
	Status     string    `json:"status"` // healthy | degraded | offline | no_data
	Total1h    int64     `json:"logs_1h"`
	Errors1h   int64     `json:"errors_1h"`
	ErrorRate1h float64  `json:"error_rate_1h"`
	Total24h   int64     `json:"logs_24h"`
	LastSeen   *time.Time `json:"last_seen"`
}

func (a *Aggregator) AppHealth(ctx context.Context) ([]AppHealth, error) {
	now := time.Now()
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":       "$app_name",
			"total_24h": bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$gte": bson.A{"$timestamp", now.Add(-24 * time.Hour)}}, 1, 0}}},
			"total_1h":  bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$gte": bson.A{"$timestamp", now.Add(-1 * time.Hour)}}, 1, 0}}},
			"errors_1h": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$and": bson.A{
					bson.M{"$gte": bson.A{"$timestamp", now.Add(-1 * time.Hour)}},
					bson.M{"$in": bson.A{"$level", bson.A{"error", "critical"}}},
				}}, 1, 0,
			}}},
			"last_seen": bson.M{"$max": "$timestamp"},
		}}},
		{{Key: "$sort", Value: bson.M{"total_24h": -1}}},
	}
	cursor, err := a.Collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	out := []AppHealth{}
	for cursor.Next(ctx) {
		var row struct {
			ID       string     `bson:"_id"`
			Total24h int64      `bson:"total_24h"`
			Total1h  int64      `bson:"total_1h"`
			Errors1h int64      `bson:"errors_1h"`
			LastSeen *time.Time `bson:"last_seen"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		h := AppHealth{
			AppName:  row.ID,
			Total1h:  row.Total1h,
			Errors1h: row.Errors1h,
			Total24h: row.Total24h,
			LastSeen: row.LastSeen,
		}
		if row.Total1h > 0 {
			h.ErrorRate1h = float64(row.Errors1h) / float64(row.Total1h)
		}
		switch {
		case row.Total24h == 0 && row.Total1h == 0 && (row.LastSeen == nil || now.Sub(*row.LastSeen) > 2*time.Hour):
			h.Status = "no_data"
			if row.LastSeen != nil {
				h.Status = "offline"
			}
		case row.LastSeen == nil || now.Sub(*row.LastSeen) > 15*time.Minute:
			h.Status = "offline"
		case h.ErrorRate1h >= 0.05:
			h.Status = "degraded"
		default:
			h.Status = "healthy"
		}
		out = append(out, h)
	}
	return out, cursor.Err()
}

// ---- Overview (dashboard header stats) ----

type Overview struct {
	Logs24h        int64   `json:"logs_24h"`
	Logs1h         int64   `json:"logs_1h"`
	Errors24h      int64   `json:"errors_24h"`
	ErrorRate24h   float64 `json:"error_rate_24h"`
	ErrorRatePrev  float64 `json:"error_rate_prev_24h"` // previous 24h, for the delta arrow
	ActiveApps     int64   `json:"active_apps"`
	OpenIncidents  int64   `json:"open_incidents"`
	OpenAnomalies  int64   `json:"open_anomalies"`
	Suppressed1h   int64   `json:"suppressed_alerts_1h"`
	LogsPerMin     float64 `json:"logs_per_min"`
}

func (a *Aggregator) Overview(ctx context.Context) (*Overview, error) {
	now := time.Now()
	ov := &Overview{}

	type cnt struct{ N int64 }
	countAt := func(filter bson.M) (int64, error) {
		n, err := a.Collection.CountDocuments(ctx, filter)
		return n, err
	}

	var err error
	if ov.Logs24h, err = countAt(bson.M{"timestamp": bson.M{"$gte": now.Add(-24 * time.Hour)}}); err != nil {
		return nil, err
	}
	if ov.Logs1h, err = countAt(bson.M{"timestamp": bson.M{"$gte": now.Add(-1 * time.Hour)}}); err != nil {
		return nil, err
	}
	if ov.Errors24h, err = countAt(bson.M{
		"timestamp": bson.M{"$gte": now.Add(-24 * time.Hour)},
		"level":     bson.M{"$in": bson.A{"error", "critical"}},
	}); err != nil {
		return nil, err
	}
	prev, err := countAt(bson.M{
		"timestamp": bson.M{"$gte": now.Add(-48 * time.Hour), "$lt": now.Add(-24 * time.Hour)},
		"level":     bson.M{"$in": bson.A{"error", "critical"}},
	})
	if err != nil {
		return nil, err
	}
	prevTotal, err := countAt(bson.M{"timestamp": bson.M{"$gte": now.Add(-48 * time.Hour), "$lt": now.Add(-24 * time.Hour)}})
	if err != nil {
		return nil, err
	}
	if ov.Logs24h > 0 {
		ov.ErrorRate24h = float64(ov.Errors24h) / float64(ov.Logs24h)
	}
	if prevTotal > 0 {
		ov.ErrorRatePrev = float64(prev) / float64(prevTotal)
	}
	if ov.Logs1h > 0 {
		ov.LogsPerMin = float64(ov.Logs1h) / 60.0
	}

	// distinct apps seen in the last 24h
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"timestamp": bson.M{"$gte": now.Add(-24 * time.Hour)}}}},
		{{Key: "$group", Value: bson.M{"_id": "$app_name"}}},
		{{Key: "$count", Value: "n"}},
	}
	cursor, err := a.Collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	if cursor.Next(ctx) {
		var row struct {
			N int64 `bson:"n"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		ov.ActiveApps = row.N
	}
	return ov, nil
}

// LevelCounts returns level → count over a range (pie charts).
func (a *Aggregator) LevelCounts(ctx context.Context, app string, since time.Time) (map[string]int64, error) {
	match := bson.M{"timestamp": bson.M{"$gte": since}}
	if app != "" {
		match["app_name"] = app
	}
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$group", Value: bson.M{"_id": "$level", "count": bson.M{"$sum": 1}}}},
	}
	cursor, err := a.Collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	out := map[string]int64{}
	for cursor.Next(ctx) {
		var row struct {
			ID    string `bson:"_id"`
			Count int64  `bson:"count"`
		}
		if err := cursor.Decode(&row); err != nil {
			return nil, err
		}
		out[row.ID] = row.Count
	}
	return out, cursor.Err()
}

// LogsBetween fetches raw entries in a window (copilot evidence).
func (a *Aggregator) LogsBetween(ctx context.Context, apps []string, since, until time.Time, levels []string, limit int64) ([]bson.M, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	filter := bson.M{"timestamp": bson.M{"$gte": since, "$lte": until}}
	if len(apps) > 0 {
		filter["app_name"] = bson.M{"$in": apps}
	}
	if len(levels) > 0 {
		filter["level"] = bson.M{"$in": levels}
	}
	opts := options.Find().SetSort(bson.M{"timestamp": 1}).SetLimit(limit)
	cursor, err := a.Collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decode logs: %w", err)
	}
	return docs, nil
}

// seeddev fills Mongo with a week of realistic synthetic logs so the
// dashboards, clustering, anomaly detection, and forecasting have data to
// chew on. It reuses the production fingerprint code so pattern grouping
// matches what ingest produces.
//
// Usage (from backend/):
//
//	MONGO_URI=mongodb://127.0.0.1:27017 MONGO_DB=logpulse go run ./cmd/seeddev [-force]
//
// Skips itself if the logs collection already holds documents unless -force.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"regexp"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"logpulse/internal/monitor"
)

type appSpec struct {
	name     string
	hourBase int // mean logs/hour during business hours
	errorPct float64
	// templates use %d / %s verbs filled with random values; the last two
	// entries of each app are the error signatures.
	templates []string
}

var apps = []appSpec{
	{
		name:     "payments-api",
		hourBase: 140,
		errorPct: 0.02,
		templates: []string{
			"charge succeeded order=ORD-%05d user=%d amount=%d.%02d USD",
			"webhook received event=payment_intent.%s id=evt_%012d",
			"charge retry attempt=%d order=ORD-%05d gateway latency=%dms",
			"failed to charge card order=ORD-%05d user=%d: gateway timeout after %dms",
			"failed to charge card order=ORD-%05d user=%d: card declined code=%02d",
		},
	},
	{
		name:     "checkout-web",
		hourBase: 220,
		errorPct: 0.015,
		templates: []string{
			"page rendered path=/checkout session=s_%08d render=%dms",
			"cart updated cart=cart_%06d items=%d",
			"slow response %d.%ds on /checkout session=s_%08d",
			"third-party script blocked vendor=analytics_%d session=s_%08d",
			"checkout submit failed session=s_%08d: http %d from /api/pay",
		},
	},
	{
		name:     "users-service",
		hourBase: 90,
		errorPct: 0.01,
		templates: []string{
			"user logged in user=%d ip=%d.%d.%d.%d",
			"profile updated user=%d fields=%d",
			"password reset requested user=%d attempts=%d",
			"login failed user=%d: invalid credentials",
			"token refresh failed user=%d: expired signature",
		},
	},
}

var verbRe = regexp.MustCompile(`%[0-9]*[ds]`)

func main() {
	force := flag.Bool("force", false, "seed even if data exists")
	flag.Parse()

	uri := env("MONGO_URI", "mongodb://127.0.0.1:27017")
	dbName := env("MONGO_DB", "logpulse")

	ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer client.Disconnect(ctx)
	coll := client.Database(dbName).Collection("logs")

	existing, err := coll.EstimatedDocumentCount(ctx)
	if err != nil {
		log.Fatalf("count: %v", err)
	}
	if existing > 0 && !*force {
		log.Printf("logs collection already has ~%d documents — nothing to do (use -force to seed anyway)", existing)
		return
	}

	now := time.Now().Truncate(time.Minute)
	start := now.Add(-7 * 24 * time.Hour)
	batch := make([]interface{}, 0, 1000)
	inserted := 0

	flush := func() {
		if len(batch) == 0 {
			return
		}
		bctx, bcancel := context.WithTimeout(ctx, 60*time.Second)
		defer bcancel()
		if _, err := coll.InsertMany(bctx, batch); err != nil {
			log.Fatalf("insert: %v", err)
		}
		inserted += len(batch)
		batch = batch[:0]
	}

	add := func(app, level, message string, t time.Time) {
		hash, pattern := monitor.Fingerprint(message)
		batch = append(batch, map[string]interface{}{
			"app_name":     app,
			"level":        level,
			"message":      message,
			"timestamp":    t,
			"pattern_hash": hash,
			"pattern":      pattern,
		})
		if len(batch) >= 1000 {
			flush()
		}
	}

	pickTemplate := func(app appSpec) string {
		// ~errorPct of traffic uses the error signatures (last 2 templates).
		if rand.Float64() < app.errorPct {
			return app.templates[len(app.templates)-2+rand.Intn(2)]
		}
		return app.templates[rand.Intn(len(app.templates)-2)]
	}

	// Walk in 5-minute steps: minute-level chart texture, modest doc count.
	for t := start; t.Before(now.Add(-40 * time.Minute)); t = t.Add(5 * time.Minute) {
		hour := t.Hour()
		// Diurnal pattern: busy 09:00–21:00, quiet overnight.
		load := 0.35
		switch {
		case hour >= 9 && hour < 21:
			load = 1.0
		case hour >= 6 && hour < 9, hour >= 21 && hour < 24:
			load = 0.6
		}
		for _, app := range apps {
			n := int(float64(app.hourBase) * load * 5 / 60 * (0.5 + rand.Float64()))
			for i := 0; i < n; i++ {
				tpl := pickTemplate(app)
				level := "info"
				if i == n-1 && rand.Float64() < 0.06 {
					level = "warning"
				}
				if rand.Float64() < app.errorPct {
					level = "error"
					tpl = app.templates[len(app.templates)-2+rand.Intn(2)]
				}
				add(app.name, level, sprintfRandom(tpl), t)
			}
		}
	}

	// Recent error burst across two services (correlation material) plus a
	// payments-api volume spike, all within the last 40 minutes.
	burstStart := now.Add(-40 * time.Minute)
	for i := 0; i < 140; i++ {
		add("payments-api", "error",
			fmt.Sprintf("failed to charge card order=ORD-%05d user=%d: dial tcp 10.0.3.7:5432: connect: connection refused",
				rand.Intn(99999), rand.Intn(9999)),
			burstStart.Add(time.Duration(rand.Intn(40))*time.Minute))
	}
	for i := 0; i < 80; i++ {
		add("users-service", "error",
			fmt.Sprintf("login failed user=%d: dial tcp 10.0.3.7:5432: connect: connection refused", rand.Intn(9999)),
			burstStart.Add(time.Duration(rand.Intn(40))*time.Minute))
	}
	for i := 0; i < 200; i++ {
		add("payments-api", "info",
			fmt.Sprintf("charge succeeded order=ORD-%05d user=%d amount=%d.%02d USD",
				rand.Intn(99999), rand.Intn(9999), rand.Intn(90), rand.Intn(99)),
			burstStart.Add(time.Duration(rand.Intn(40))*time.Minute))
	}
	flush()

	log.Printf("seeded %d log documents across %d apps into %s/logs", inserted, len(apps), dbName)
}

// sprintfRandom fills a template's %d/%s verbs with plausible values.
func sprintfRandom(tpl string) string {
	return verbRe.ReplaceAllStringFunc(tpl, func(v string) string {
		if v[len(v)-1] == 's' {
			return []string{"succeeded", "captured", "refunded"}[rand.Intn(3)]
		}
		return fmt.Sprintf("%d", rand.Intn(99999))
	})
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

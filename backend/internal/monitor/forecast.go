package monitor

import (
	"context"
	"math"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// Forecast predicts per-app log volume for the next 24 hours from the last
// 7 days of hourly counts (AI-7). It combines a linear trend with the
// hour-of-day profile so daily rhythms survive the prediction.

type ForecastPoint struct {
	Bucket    string  `json:"bucket"` // RFC3339 UTC
	Predicted float64 `json:"predicted"`
	Lower     float64 `json:"lower"`
	Upper     float64 `json:"upper"`
}

type Forecast struct {
	AppName        string          `json:"app_name"`
	GeneratedAt    time.Time       `json:"generated_at"`
	HistoryHours   int             `json:"history_hours"`
	CurrentDaily   float64         `json:"current_daily"`  // avg logs/day over history
	PredictedDaily float64         `json:"predicted_daily"`
	GrowthPerDay   float64         `json:"growth_per_day"` // % change vs current daily
	EstimatedBytesPerLog float64   `json:"estimated_bytes_per_log"`
	DaysToDouble   float64         `json:"days_to_double"` // 0 = no growth trend
	Storage30dGB   float64         `json:"storage_30d_gb"` // estimated 30-day ingest volume
	Points         []ForecastPoint `json:"points"`
	Baseline       []BucketPoint   `json:"baseline"` // trailing history shown alongside
	Note           string          `json:"note"`
}

const forecastHorizonHours = 24

func (d *Detector) Forecast(ctx context.Context, app string) (*Forecast, error) {
	historyHours := 7 * 24
	now := time.Now().Truncate(time.Hour)
	since := now.Add(-time.Duration(historyHours) * time.Hour)

	buckets, err := d.Agg.Timeseries(ctx, app, since, now, time.Hour)
	if err != nil {
		return nil, err
	}

	// y[i] = count for hour i, in chronological order.
	var ys []float64
	for _, b := range buckets {
		ys = append(ys, float64(b.Total))
	}

	fc := &Forecast{
		AppName:      app,
		GeneratedAt:  time.Now(),
		HistoryHours: len(ys),
		Baseline:     buckets,
		Points:       []ForecastPoint{}, // marshal as [] not null
	}
	if fc.Baseline == nil {
		fc.Baseline = []BucketPoint{}
	}

	if len(ys) < 24 {
		fc.Note = "Not enough history yet — forecasts need at least 24 hours of logs."
		return fc, nil
	}

	slope, intercept := linearFit(ys)
	residStd := residualStd(ys, slope, intercept)

	// Average hourly volume over history → daily rate.
	total := 0.0
	for _, y := range ys {
		total += y
	}
	fc.CurrentDaily = total / float64(len(ys)) * 24

	// Estimate bytes per log from a sample of recent documents so the
	// storage projection reflects the actual payload shape.
	if perDoc, err := d.Agg.AvgDocBytes(ctx, app, now.Add(-24*time.Hour)); err == nil && perDoc > 0 {
		fc.EstimatedBytesPerLog = perDoc
	} else {
		fc.EstimatedBytesPerLog = 300 // typical structured JSON log line
	}

	// Hour-of-day multipliers smooth out the linear fit's blindness to
	// daily rhythm (traffic peaks, cron bursts, nightly quiet).
	hourProfile := make([]float64, 24)
	hourCount := make([]int, 24)
	for i, b := range buckets {
		hr, err := time.Parse(time.RFC3339, b.Bucket)
		if err != nil {
			continue
		}
		hourProfile[hr.Hour()] += ys[i]
		hourCount[hr.Hour()]++
	}
	profileSum := 0.0
	for h := 0; h < 24; h++ {
		if hourCount[h] > 0 {
			hourProfile[h] /= float64(hourCount[h])
		}
		profileSum += hourProfile[h]
	}
	if profileSum <= 0 {
		for h := range hourProfile {
			hourProfile[h] = 1
			hourCount[h] = 1
		}
		profileSum = 24
	}
	for h := 0; h < 24; h++ {
		if hourCount[h] == 0 {
			hourProfile[h] = profileSum / 24
		}
	}

	predictedSum := 0.0
	for i := 1; i <= forecastHorizonHours; i++ {
		t := now.Add(time.Duration(i) * time.Hour)
		trend := intercept + slope*float64(len(ys)+i-1)
		mult := hourProfile[t.Hour()] / (profileSum / 24)
		if mult <= 0 {
			mult = 1
		}
		pred := math.Max(0, trend*mult)
		lo := math.Max(0, pred-1.5*residStd)
		hi := pred + 1.5*residStd
		fc.Points = append(fc.Points, ForecastPoint{
			Bucket:    t.UTC().Format(time.RFC3339),
			Predicted: round2(pred),
			Lower:     round2(lo),
			Upper:     round2(hi),
		})
		predictedSum += pred
	}

	fc.PredictedDaily = predictedSum
	if fc.CurrentDaily > 0 {
		fc.GrowthPerDay = round2((fc.PredictedDaily - fc.CurrentDaily) / fc.CurrentDaily * 100)
	}
	if slope > 0 {
		// Days until the linear trend doubles today's daily volume.
		if target := math.Max(fc.CurrentDaily, 1); intercept+slope*float64(len(ys)) > 0 {
			hoursToTarget := (target*24 - intercept*24) / (slope * 24)
			if hoursToTarget > 0 {
				fc.DaysToDouble = round2(hoursToTarget / 24)
			}
		}
	}

	// 30-day projected ingest size in GB.
	dailyBytes := fc.PredictedDaily * fc.EstimatedBytesPerLog
	fc.Storage30dGB = round2(dailyBytes * 30 / (1024 * 1024 * 1024))
	if fc.Note == "" {
		fc.Note = "Trend + hour-of-day model; the band is ±1.5σ of fit residuals. Treat as planning input, not a guarantee."
	}
	return fc, nil
}

func linearFit(ys []float64) (slope, intercept float64) {
	n := float64(len(ys))
	if n < 2 {
		return 0, mean(ys)
	}
	var sx, sy, sxy, sxx float64
	for i, y := range ys {
		sx += float64(i)
		sy += y
		sxy += float64(i) * y
		sxx += float64(i) * float64(i)
	}
	denom := n*sxx - sx*sx
	if denom == 0 {
		return 0, sy / n
	}
	slope = (n*sxy - sx*sy) / denom
	intercept = (sy - slope*sx) / n
	return slope, intercept
}

func residualStd(ys []float64, slope, intercept float64) float64 {
	res := make([]float64, len(ys))
	for i, y := range ys {
		res[i] = y - (intercept + slope*float64(i))
	}
	return math.Max(stdDev(res, mean(res)), 1)
}

// AvgDocBytes estimates the average stored size of a log document via agg.
func (a *Aggregator) AvgDocBytes(ctx context.Context, app string, since time.Time) (float64, error) {
	match := bson.M{"timestamp": bson.M{"$gte": since}}
	if app != "" {
		match["app_name"] = app
	}
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$limit", Value: 500}},
		{{Key: "$project", Value: bson.M{
			"size": bson.M{"$bsonSize": "$$ROOT"},
		}}},
		{{Key: "$group", Value: bson.M{"_id": nil, "avg": bson.M{"$avg": "$size"}}}},
	}
	cursor, err := a.Collection.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)
	if cursor.Next(ctx) {
		var row struct {
			Avg float64 `bson:"avg"`
		}
		if err := cursor.Decode(&row); err != nil {
			return 0, err
		}
		return row.Avg, nil
	}
	return 0, nil
}

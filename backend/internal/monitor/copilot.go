package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"

	"logpulse/internal/models"
)

// Copilot builds an evidence-first analysis for an incident (AI-5): what
// happened, which failure signatures dominate, and ranked hypotheses — each
// citing the actual log lines it is based on. It is heuristic on purpose:
// conclusions stay suggestions an operator confirms, and no data ever leaves
// the deployment (see FRD §4 non-functional note).

type Evidence struct {
	AppName   string    `json:"app_name"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	LogID     string    `json:"log_id,omitempty"`
}

type Hypothesis struct {
	Statement  string    `json:"statement"`
	Confidence float64   `json:"confidence"` // 0..1
	Rationale  string    `json:"rationale"`
	Evidence   []Evidence `json:"evidence"`
}

type CopilotAnalysis struct {
	IncidentID   uint            `json:"incident_id"`
	Title        string          `json:"title"`
	Summary      string          `json:"summary"`
	Timeline     []TimelinePoint `json:"timeline"`
	Signatures   []Cluster       `json:"signatures"`
	AffectedApps []string        `json:"affected_apps"`
	Fields       []FieldHint     `json:"field_hints"`
	Hypotheses   []Hypothesis    `json:"hypotheses"`
	Evidence     []Evidence      `json:"evidence"`
	GeneratedAt  time.Time       `json:"generated_at"`
	Note         string          `json:"note"`
}

type TimelinePoint struct {
	Bucket string `json:"bucket"`
	Total  int64  `json:"total"`
	Errors int64  `json:"errors"`
}

type FieldHint struct {
	Key    string         `json:"key"`
	Values map[string]int `json:"values"`
	Hint   string         `json:"hint,omitempty"`
}

const (
	copilotLookback = 15 * time.Minute // window before incident start
	maxEvidence     = 12
)

func (d *Detector) AnalyzeIncident(ctx context.Context, inc *models.Incident) (*CopilotAnalysis, error) {
	apps := []string{}
	_ = json.Unmarshal([]byte(inc.AffectedApps), &apps)
	if len(apps) == 0 {
		apps = nil
	}

	until := time.Now()
	if inc.ResolvedAt != nil {
		until = *inc.ResolvedAt
	}
	since := inc.StartedAt.Add(-copilotLookback)

	analysis := &CopilotAnalysis{
		IncidentID:   inc.ID,
		Title:        inc.Title,
		Summary:      inc.Summary,
		AffectedApps: apps,
		GeneratedAt:  time.Now(),
		Note:         "Heuristic analysis over the incident window — every hypothesis cites the logs it is based on. Confirm before acting.",
	}

	// 1) Fine-grained timeline over the incident window.
	buckets, err := d.Agg.Timeseries(ctx, "", since, until, 5*time.Minute)
	if err != nil {
		return nil, err
	}
	var peakTotal int64
	for _, b := range buckets {
		tp := TimelinePoint{Bucket: b.Bucket, Total: b.Total, Errors: b.Error + b.Critical}
		analysis.Timeline = append(analysis.Timeline, tp)
		if tp.Total > peakTotal {
			peakTotal = tp.Total
		}
	}

	// 2) Dominant failure signatures (AI-1 clusters over the window).
	sigs, err := d.Agg.Clusters(ctx, "", "error", since, 1, 10)
	if err != nil {
		return nil, err
	}
	critSigs, _ := d.Agg.Clusters(ctx, "", "critical", since, 1, 5)
	sigs = append(sigs, critSigs...)
	sort.SliceStable(sigs, func(i, j int) bool { return sigs[i].Count > sigs[j].Count })
	analysis.Signatures = sigs

	// 3) Raw evidence lines (errors first) with shared meta hints.
	docs, err := d.Agg.LogsBetween(ctx, apps, since, until, []string{"error", "critical"}, 300)
	if err != nil {
		return nil, err
	}
	if len(docs) == 0 {
		docs, _ = d.Agg.LogsBetween(ctx, apps, since, until, nil, 100)
	}
	evidence := make([]Evidence, 0, maxEvidence)
	for i, doc := range docs {
		if i >= maxEvidence {
			break
		}
		evidence = append(evidence, docToEvidence(doc))
	}
	analysis.Evidence = evidence
	analysis.Fields = metaHints(docs)

	// 4) Hypotheses from failure-signature shape + message content.
	analysis.Hypotheses = buildHypotheses(sigs, docs, apps, len(analysis.Timeline) > 0 && peakTotal > 0)

	// Marshal empty slices as [] not null — the UI reads .length on these.
	if analysis.AffectedApps == nil {
		analysis.AffectedApps = []string{}
	}
	if analysis.Timeline == nil {
		analysis.Timeline = []TimelinePoint{}
	}
	if analysis.Signatures == nil {
		analysis.Signatures = []Cluster{}
	}
	if analysis.Hypotheses == nil {
		analysis.Hypotheses = []Hypothesis{}
	}
	if analysis.Evidence == nil {
		analysis.Evidence = []Evidence{}
	}
	if analysis.Fields == nil {
		analysis.Fields = []FieldHint{}
	}
	return analysis, nil
}

func docToEvidence(doc bson.M) Evidence {
	e := Evidence{}
	if id, ok := doc["_id"].(string); ok {
		e.LogID = id
	}
	if v, ok := doc["app_name"].(string); ok {
		e.AppName = v
	}
	if v, ok := doc["level"].(string); ok {
		e.Level = v
	}
	if v, ok := doc["message"].(string); ok {
		e.Message = v
	}
	if v, ok := doc["timestamp"].(time.Time); ok {
		e.Timestamp = v
	}
	if len(e.Message) > 300 {
		e.Message = e.Message[:300] + "…"
	}
	return e
}

// metaHints surfaces the most common structured fields on error logs —
// e.g. a single host or error code dominating is a classic root-cause hint.
func metaHints(docs []bson.M) []FieldHint {
	counts := map[string]map[string]int{}
	for _, doc := range docs {
		meta, ok := doc["meta"].(map[string]interface{})
		if !ok {
			continue
		}
		for k, v := range meta {
			s := fmt.Sprintf("%v", v)
			if len(s) > 80 {
				s = s[:80]
			}
			if counts[k] == nil {
				counts[k] = map[string]int{}
			}
			counts[k][s]++
		}
	}

	hints := []FieldHint{}
	for k, vals := range counts {
		total := 0
		topVal, topN := "", 0
		for v, n := range vals {
			total += n
			if n > topN {
				topVal, topN = v, n
			}
		}
		if total < 3 || len(counts) > 12 && total < 5 {
			continue
		}
		h := FieldHint{Key: k, Values: topValues(vals, 5)}
		if total > 0 && float64(topN)/float64(total) >= 0.7 {
			h.Hint = fmt.Sprintf("%q appears in %.0f%% of affected logs — investigate this %s", topVal, float64(topN)/float64(total)*100, k)
		}
		hints = append(hints, h)
	}
	sort.Slice(hints, func(i, j int) bool { return hints[i].Key < hints[j].Key })
	if len(hints) > 6 {
		hints = hints[:6]
	}
	return hints
}

func topValues(m map[string]int, n int) map[string]int {
	type kv struct {
		k string
		v int
	}
	list := make([]kv, 0, len(m))
	for k, v := range m {
		list = append(list, kv{k, v})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].v > list[j].v })
	out := map[string]int{}
	for i, item := range list {
		if i >= n {
			break
		}
		out[item.k] = item.v
	}
	return out
}

// buildHypotheses turns signature shape and message keywords into ranked,
// evidence-cited hypotheses. Confidence is heuristic, not probabilistic.
func buildHypotheses(sigs []Cluster, docs []bson.M, apps []string, hasTimeline bool) []Hypothesis {
	hypotheses := []Hypothesis{}
	if len(sigs) == 0 {
		return hypotheses
	}

	allMessages := ""
	for _, doc := range docs {
		if m, ok := doc["message"].(string); ok {
			allMessages += " " + strings.ToLower(m)
		}
	}

	// Signature with the highest repetition is usually the primary failure.
	primary := sigs[0]
	conf := 0.55
	if primary.Count >= 10 {
		conf = 0.7
	}
	if primary.Count >= 100 {
		conf = 0.85
	}

	hypotheses = append(hypotheses, Hypothesis{
		Statement: fmt.Sprintf("A repeating failure signature accounts for %d of the affected log lines: %q.",
			primary.Count, truncate(primary.Pattern, 140)),
		Confidence: conf,
		Rationale:  "One normalized pattern dominating the window means a single code path or dependency is failing repeatedly, rather than many unrelated errors.",
		Evidence:   []Evidence{{AppName: primary.Apps[0], Level: primary.Level, Message: primary.Sample, Timestamp: primary.LastSeen}},
	})

	// Dependency failures: connection/timeout/DNS keywords.
	if hit := keywordHit(allMessages,
		"connection refused", "connection reset", "dial tcp", "timeout", "timed out",
		"no such host", "i/o timeout", "econnrefused", "etimedout", "unreachable"); hit != "" {
		hypotheses = append(hypotheses, Hypothesis{
			Statement:  fmt.Sprintf("Downstream dependency failure — messages contain %q.", hit),
			Confidence: 0.65,
			Rationale:  "Connection-refused/timeout/DNS language across the window typically indicates an unreachable database, cache, or upstream API rather than application logic.",
			Evidence:   sampleKeywordEvidence(docs, hit, 3),
		})
	}

	// Resource exhaustion signatures.
	if hit := keywordHit(allMessages,
		"out of memory", "oom", "killed", "too many open files", "disk full",
		"no space left", "connection pool", "pool exhausted", "rate limit", "429"); hit != "" {
		hypotheses = append(hypotheses, Hypothesis{
			Statement:  fmt.Sprintf("Resource exhaustion or throttling — messages contain %q.", hit),
			Confidence: 0.6,
			Rationale:  "Memory/file-descriptor/pool/rate-limit language points at capacity limits, not bugs; check usage metrics for the affected window.",
			Evidence:   sampleKeywordEvidence(docs, hit, 3),
		})
	}

	// Cross-service correlation: same signature in multiple apps.
	for _, s := range sigs {
		if len(s.Apps) > 1 {
			hypotheses = append(hypotheses, Hypothesis{
				Statement: fmt.Sprintf("Shared failure signature across %d services (%s) — likely one shared dependency.",
					len(s.Apps), truncate(strings.Join(s.Apps, ", "), 100)),
				Confidence: 0.7,
				Rationale:  "The same normalized pattern appearing in multiple applications at the same time implicates something they all depend on (shared DB, broker, config, network).",
				Evidence:   []Evidence{{AppName: s.Apps[0], Level: s.Level, Message: s.Sample, Timestamp: s.LastSeen}},
			})
			break
		}
	}

	// Burst profile: steep single-bucket peak vs sustained plateau.
	if hasTimeline && len(hypotheses) < 4 {
		hypotheses = append(hypotheses, Hypothesis{
			Statement:  "Check the timeline shape: a sharp single-bucket peak suggests a deploy, cron job, or traffic burst; a sustained plateau suggests an ongoing failing state.",
			Confidence: 0.4,
			Rationale:  "The 5-minute timeline above shows where volume concentrated; correlate that moment with recent changes.",
			Evidence:   []Evidence{},
		})
	}

	sort.SliceStable(hypotheses, func(i, j int) bool { return hypotheses[i].Confidence > hypotheses[j].Confidence })
	return hypotheses
}

func keywordHit(messages string, keywords ...string) string {
	for _, k := range keywords {
		if strings.Contains(messages, k) {
			return k
		}
	}
	return ""
}

func sampleKeywordEvidence(docs []bson.M, keyword string, n int) []Evidence {
	out := []Evidence{}
	for _, doc := range docs {
		if m, ok := doc["message"].(string); ok && strings.Contains(strings.ToLower(m), keyword) {
			out = append(out, docToEvidence(doc))
			if len(out) >= n {
				break
			}
		}
	}
	return out
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

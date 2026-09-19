package handlers

import (
	"context"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/gorm"

	"logpulse/internal/models"
)

// SearchHandler backs the frontend command palette's single aggregating
// endpoint: GET /api/search?q=... fans the query out to the existing search
// surfaces (logs in Mongo, applications + incidents in Postgres, the docs
// site's page index) so the client fires one request, not four.
type SearchHandler struct {
	DB         *gorm.DB
	Collection *mongo.Collection
}

type SearchItem struct {
	ID       string `json:"id"`
	Kind     string `json:"kind"` // log | application | incident | doc
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Href     string `json:"href"`
	// Log-only fields: the log detail page renders from navigation state
	// rather than a per-log fetch, so the client needs the whole entry.
	AppName   string    `json:"app_name,omitempty"`
	Level     string    `json:"level,omitempty"`
	Message   string    `json:"message,omitempty"`
	Timestamp time.Time `json:"timestamp,omitempty"`
}

type SearchGroup struct {
	Label string       `json:"label"`
	Items []SearchItem `json:"items"`
}

const searchGroupLimit = 5

// Search handles GET /api/search?q=... Empty groups are omitted so the
// palette only renders sections that actually have hits.
func (h *SearchHandler) Search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusOK, gin.H{"query": q, "groups": []SearchGroup{}})
		return
	}

	groups := make([]SearchGroup, 0, 4)
	for _, fn := range []func(*gin.Context, string) SearchGroup{
		h.searchLogs,
		h.searchApplications,
		h.searchIncidents,
		h.searchDocs,
	} {
		if g := fn(c, q); len(g.Items) > 0 {
			groups = append(groups, g)
		}
	}

	c.JSON(http.StatusOK, gin.H{"query": q, "groups": groups})
}

// searchLogs greps recent log messages and app names. Unlike LogHandler.List
// the query is regex-escaped first — palette input is free text and an
// unescaped "(" would kill the whole request.
func (h *SearchHandler) searchLogs(c *gin.Context, q string) SearchGroup {
	group := SearchGroup{Label: "Logs"}

	pattern := regexp.QuoteMeta(q)
	filter := bson.M{"$or": []bson.M{
		{"message": bson.M{"$regex": pattern, "$options": "i"}},
		{"app_name": bson.M{"$regex": pattern, "$options": "i"}},
	}}

	ctx, cancel := context.WithTimeout(c, 3*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.M{"timestamp": -1}).SetLimit(searchGroupLimit)
	cursor, err := h.Collection.Find(ctx, filter, opts)
	if err != nil {
		return group
	}
	defer cursor.Close(ctx)

	var entries []models.LogEntry
	if err := cursor.All(ctx, &entries); err != nil {
		return group
	}
	for _, e := range entries {
		group.Items = append(group.Items, SearchItem{
			ID:        e.ID,
			Kind:      "log",
			Title:     truncateString(e.Message, 100),
			Subtitle:  e.AppName + " · " + e.Level,
			Href:      "/logs/" + e.ID,
			AppName:   e.AppName,
			Level:     e.Level,
			Message:   e.Message,
			Timestamp: e.Timestamp,
		})
	}
	return group
}

// searchApplications matches app names.
// TODO: there is no per-application detail route yet, so every hit links to
// the Applications page as a whole.
func (h *SearchHandler) searchApplications(c *gin.Context, q string) SearchGroup {
	group := SearchGroup{Label: "Applications"}

	var apps []models.Application
	if err := h.DB.Where("name ILIKE ?", "%"+escapeLike(q)+"%").
		Order("name asc").Limit(searchGroupLimit).Find(&apps).Error; err != nil {
		return group
	}
	for _, a := range apps {
		group.Items = append(group.Items, SearchItem{
			ID:       strconv.FormatUint(uint64(a.ID), 10),
			Kind:     "application",
			Title:    a.Name,
			Subtitle: "Application",
			Href:     "/applications",
		})
	}
	return group
}

// searchIncidents matches incident titles and summaries.
// TODO: the Incidents page has no deep-link/selection URL param yet, so hits
// land on the list page.
func (h *SearchHandler) searchIncidents(c *gin.Context, q string) SearchGroup {
	group := SearchGroup{Label: "Incidents"}

	var incidents []models.Incident
	pattern := "%" + escapeLike(q) + "%"
	if err := h.DB.Where("title ILIKE ? OR summary ILIKE ?", pattern, pattern).
		Order("created_at desc").Limit(searchGroupLimit).Find(&incidents).Error; err != nil {
		return group
	}
	for _, in := range incidents {
		group.Items = append(group.Items, SearchItem{
			ID:       strconv.FormatUint(uint64(in.ID), 10),
			Kind:     "incident",
			Title:    in.Title,
			Subtitle: string(in.Severity) + " · " + string(in.Status),
			Href:     "/incidents",
		})
	}
	return group
}

// docPage is one entry in the compiled-in docs index. The docs site is a
// separate Docusaurus build, so items carry its route paths and the client
// prefixes its own docs origin (VITE_DOCS_URL).
type docPage struct {
	Title    string
	Path     string
	Keywords string
}

var docIndex = []docPage{
	{"Introduction", "/docs/intro", "overview features logpulse"},
	{"Installation", "/docs/getting-started/installation", "setup install getting started docker"},
	{"First Logs", "/docs/getting-started/first-logs", "ingest send tutorial quickstart api key"},
	{"Architecture", "/docs/architecture", "design components stack diagram"},
	{"API Reference", "/api-reference", "rest api openapi endpoints redoc"},
	{"WebSocket Protocol", "/docs/websocket-protocol", "live stream ws realtime"},
	{"Configuration", "/docs/configuration", "env variables environment smtp settings"},
	{"Deployment", "/docs/deployment", "docker compose production nginx"},
	{"SDKs", "/docs/sdks", "go node python client libraries"},
	{"Troubleshooting", "/docs/troubleshooting", "problems faq errors"},
	{"Changelog", "/docs/changelog", "releases versions"},
}

// searchDocs matches the static docs index by title/keyword substring. With
// ~a dozen pages that's plenty; TODO: generate this from the docs site's
// sitemap if the page count grows.
func (h *SearchHandler) searchDocs(c *gin.Context, q string) SearchGroup {
	group := SearchGroup{Label: "Documentation"}
	needle := strings.ToLower(q)

	for _, p := range docIndex {
		haystack := strings.ToLower(p.Title + " " + p.Keywords)
		if strings.Contains(haystack, needle) {
			group.Items = append(group.Items, SearchItem{
				ID:       p.Path,
				Kind:     "doc",
				Title:    p.Title,
				Subtitle: "Documentation",
				Href:     p.Path,
			})
			if len(group.Items) >= searchGroupLimit {
				break
			}
		}
	}
	return group
}

func truncateString(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-1]) + "…"
}

// escapeLike neutralizes LIKE wildcards so a query of "100%" matches the
// literal string, not "100" followed by anything.
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	return strings.ReplaceAll(s, `_`, `\_`)
}

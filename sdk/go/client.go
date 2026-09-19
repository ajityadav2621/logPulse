package logpulse

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	defaultBaseURL    = "http://localhost:8080"
	defaultBufferSize = 100
	defaultFlushInterval = 5 * time.Second
)

type LogLevel string

const (
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
)

type LogEntry struct {
	AppName   string                 `json:"app_name"`
	Level     LogLevel               `json:"level"`
	Message   string                 `json:"message"`
	Meta      map[string]interface{} `json:"meta,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

type ClientOption func(*Client)

type Client struct {
	apiKey        string
	appName       string
	baseURL       string
	httpClient    *http.Client
	buffer        chan LogEntry
	flushInterval time.Duration
	wg            sync.WaitGroup
	mu            sync.Mutex
	closed        bool
}

func New(apiKey, appName string, opts ...ClientOption) *Client {
	c := &Client{
		apiKey:        apiKey,
		appName:       appName,
		baseURL:       defaultBaseURL,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
		buffer:        make(chan LogEntry, defaultBufferSize),
		flushInterval: defaultFlushInterval,
	}

	for _, opt := range opts {
		opt(c)
	}

	if c.buffer != nil {
		c.wg.Add(1)
		go c.worker()
	}

	return c
}

func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = url
	}
}

func WithBufferSize(size int) ClientOption {
	return func(c *Client) {
		if size > 0 {
			c.buffer = make(chan LogEntry, size)
		}
	}
}

func WithFlushInterval(interval time.Duration) ClientOption {
	return func(c *Client) {
		c.flushInterval = interval
	}
}

func WithHTTPClient(client *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = client
	}
}

func (c *Client) sendSync(entry LogEntry) error {
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/api/logs", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("logpulse: ingest failed with status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func (c *Client) sendAsync(entry LogEntry) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return
	}
	c.mu.Unlock()

	select {
	case c.buffer <- entry:
	default:
		// Buffer full, fallback to sync send
		_ = c.sendSync(entry)
	}
}

func (c *Client) worker() {
	defer c.wg.Done()
	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()

	var batch []LogEntry

	flush := func() {
		if len(batch) == 0 {
			return
		}
		// Send all entries in batch
		for _, entry := range batch {
			_ = c.sendSync(entry)
		}
		batch = nil
	}

	for {
		select {
		case entry, ok := <-c.buffer:
			if !ok {
				flush()
				return
			}
			batch = append(batch, entry)
			if len(batch) >= cap(c.buffer) {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func (c *Client) Log(level LogLevel, message string, fields map[string]interface{}) {
	entry := LogEntry{
		AppName:   c.appName,
		Level:     level,
		Message:   message,
		Meta:      fields,
		Timestamp: time.Now().UTC(),
	}

	if c.buffer != nil {
		c.sendAsync(entry)
	} else {
		_ = c.sendSync(entry)
	}
}

func (c *Client) Info(message string, fields map[string]interface{}) {
	c.Log(LevelInfo, message, fields)
}

func (c *Client) Warn(message string, fields map[string]interface{}) {
	c.Log(LevelWarn, message, fields)
}

func (c *Client) Error(message string, fields map[string]interface{}) {
	c.Log(LevelError, message, fields)
}

func (c *Client) Close() error {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil
	}
	c.closed = true
	c.mu.Unlock()

	if c.buffer != nil {
		close(c.buffer)
	}
	c.wg.Wait()
	return nil
}

func (c *Client) Flush() error {
	return nil
}

var globalClient *Client
var globalOnce sync.Once

func Global() *Client {
	return globalClient
}

func InitGlobal(apiKey, appName string, opts ...ClientOption) {
	globalOnce.Do(func() {
		globalClient = New(apiKey, appName, opts...)
	})
}

func Info(message string, fields ...interface{}) {
	if globalClient == nil {
		fmt.Fprintf(os.Stderr, "logpulse: global client not initialized\n")
		return
	}
	f := fieldsToMap(fields)
	globalClient.Info(message, f)
}

func Warn(message string, fields ...interface{}) {
	if globalClient == nil {
		fmt.Fprintf(os.Stderr, "logpulse: global client not initialized\n")
		return
	}
	f := fieldsToMap(fields)
	globalClient.Warn(message, f)
}

func Error(message string, fields ...interface{}) {
	if globalClient == nil {
		fmt.Fprintf(os.Stderr, "logpulse: global client not initialized\n")
		return
	}
	f := fieldsToMap(fields)
	globalClient.Error(message, f)
}

func fieldsToMap(fields []interface{}) map[string]interface{} {
	m := make(map[string]interface{})
	for i := 0; i < len(fields); i += 2 {
		if i+1 < len(fields) {
			key, ok := fields[i].(string)
			if ok {
				m[key] = fields[i+1]
			}
		}
	}
	return m
}

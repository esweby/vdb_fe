// Package ingest fetches a final day of FaBlazing games, keeps the Viserai
// games and stores their raw records.
//
// It never logs or returns the API key or the signed download URL: logs carry
// counts only.
package ingest

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// Store holds the raw records.
type Store interface {
	Exists(ctx context.Context, key string) (bool, error)
	Put(ctx context.Context, key string, body []byte) error
}

// Aggregator turns one day and format of games into aggregates. It gets every
// game, not only the Viserai ones: matchups and the run summary cover them all.
// Supabase is the Aggregator in the Lambda; nil skips the step.
type Aggregator interface {
	Aggregate(ctx context.Context, date string, format int, games []game.Game) error
}

// Ingester runs one day for each format.
type Ingester struct {
	BaseURL    string // e.g. https://fab-insights.azurewebsites.net
	APIKey     string
	Formats    []int
	HTTP       *http.Client
	Store      Store
	Aggregator Aggregator // optional
	TempDir    string     // where the day's CSV is spooled; "" for the system default
	Logger     *slog.Logger
}

// FormatResult counts one format's day. Rows are CSV rows, Games are distinct
// guids, Kept are games with Viserai on either side.
type FormatResult struct {
	Format                          int
	Skipped                         bool // already stored, so not fetched again
	Rows, Games, Kept, ViseraiSides int
}

// Key is where a day and format's raw records live.
func Key(date string, format int) string {
	return fmt.Sprintf("raw/date=%s/format=%d.ndjson.gz", date, format)
}

// Run ingests each format for a final date. A format already in the store is
// skipped, so a rerun never fetches a day from FaBlazing twice.
func (in *Ingester) Run(ctx context.Context, date string) ([]FormatResult, error) {
	var results []FormatResult
	for _, f := range in.Formats {
		r, err := in.runFormat(ctx, date, f)
		if err != nil {
			in.Logger.Error("format failed", "date", date, "format", f)
			return results, fmt.Errorf("format %d: %w", f, err)
		}
		in.Logger.Info("format done", "date", date, "format", f, "skipped", r.Skipped,
			"rows", r.Rows, "games", r.Games, "kept", r.Kept, "viserai_sides", r.ViseraiSides)
		results = append(results, r)
	}
	return results, nil
}

func (in *Ingester) runFormat(ctx context.Context, date string, format int) (FormatResult, error) {
	r := FormatResult{Format: format}
	key := Key(date, format)
	exists, err := in.Store.Exists(ctx, key)
	if err != nil {
		return r, fmt.Errorf("checking the store: %w", err)
	}
	if exists {
		r.Skipped = true
		return r, nil
	}

	link, err := in.downloadURL(ctx, date, format)
	if err != nil {
		return r, err
	}
	file, err := os.CreateTemp(in.TempDir, "fablazing-*.csv")
	if err != nil {
		return r, err
	}
	defer os.Remove(file.Name())
	defer file.Close()
	if err := in.download(ctx, link, file); err != nil {
		return r, err
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return r, err
	}
	games, err := game.ReadAll(file)
	if err != nil {
		return r, fmt.Errorf("parsing: %w", err)
	}
	r.Games = len(games)
	keep := map[string]string{} // guid → created_at of the copy ReadAll kept
	kept := 0
	for _, g := range games {
		sides := 0
		for _, s := range g.Sides {
			if game.IsViserai(s.Hero) {
				sides++
			}
		}
		if sides > 0 {
			keep[g.GUID] = g.CreatedAt
			kept++
			r.ViseraiSides += sides
		}
	}
	r.Kept = kept

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return r, err
	}
	body, rows, err := rawRecords(file, keep)
	if err != nil {
		return r, err
	}
	r.Rows = rows
	// Aggregates first: the day is only stored once they're written, so a
	// failure leaves nothing to skip on a rerun. Replacing a day is idempotent.
	if in.Aggregator != nil {
		if err := in.Aggregator.Aggregate(ctx, date, format, games); err != nil {
			return r, fmt.Errorf("aggregating: %w", err)
		}
	}
	if err := in.Store.Put(ctx, key, body); err != nil {
		return r, fmt.Errorf("storing: %w", err)
	}
	return r, nil
}

// downloadURL asks the API for the day's signed URL.
func (in *Ingester) downloadURL(ctx context.Context, date string, format int) (string, error) {
	q := url.Values{"format": {strconv.Itoa(format)}, "date": {date}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, in.BaseURL+"/api/v1/download_csv?"+q.Encode(), nil)
	if err != nil {
		return "", errors.New("building the API request")
	}
	req.Header.Set("x-functions-key", in.APIKey)
	resp, err := in.HTTP.Do(req)
	if err != nil {
		return "", fmt.Errorf("calling the API: %w", withoutURL(err))
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("calling the API: status %d", resp.StatusCode)
	}
	var body struct {
		DownloadURL string `json:"download_url"`
		Date        string `json:"date"`
		Format      any    `json:"format"` // a string today; accept a number too
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("reading the API response: %w", err)
	}
	if body.Date != date || fmt.Sprint(body.Format) != strconv.Itoa(format) {
		return "", fmt.Errorf("the API answered for date %s format %v, not date %s format %d", body.Date, body.Format, date, format)
	}
	if body.DownloadURL == "" {
		return "", errors.New("the API response has no download_url")
	}
	return body.DownloadURL, nil
}

func (in *Ingester) download(ctx context.Context, link string, w io.Writer) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, link, nil)
	if err != nil {
		return errors.New("downloading: the signed URL is malformed")
	}
	resp, err := in.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("downloading: %w", withoutURL(err))
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("downloading: status %d", resp.StatusCode)
	}
	if _, err := io.Copy(w, resp.Body); err != nil {
		return fmt.Errorf("downloading: %w", withoutURL(err))
	}
	return nil
}

// withoutURL drops the URL from an HTTP client error: a signed URL is a secret.
func withoutURL(err error) error {
	var ue *url.Error
	if errors.As(err, &ue) {
		return ue.Err
	}
	return err
}

// rawRecords writes each kept game's raw row, every column as text, as
// gzipped NDJSON. It returns the number of CSV rows read.
func rawRecords(r io.Reader, keep map[string]string) ([]byte, int, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	head, err := cr.Read()
	if err != nil {
		return nil, 0, fmt.Errorf("reading header: %w", err)
	}
	col := map[string]int{}
	for i, h := range head {
		col[h] = i
	}
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	enc := json.NewEncoder(zw)
	written := map[string]bool{}
	rows := 0
	for {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, rows, fmt.Errorf("line %d: %w", rows+2, err)
		}
		rows++
		guid, createdAt := field(rec, col, "game_guid"), field(rec, col, "created_at")
		if want, ok := keep[guid]; !ok || want != createdAt || written[guid] {
			continue
		}
		written[guid] = true
		row := make(map[string]string, len(head))
		for _, h := range head {
			row[h] = field(rec, col, h)
		}
		if err := enc.Encode(row); err != nil {
			return nil, rows, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, rows, err
	}
	return buf.Bytes(), rows, nil
}

func field(rec []string, col map[string]int, k string) string {
	if i, ok := col[k]; ok && i < len(rec) {
		return rec[i]
	}
	return ""
}

// DateFor is the date to ingest: the requested one, or yesterday in UTC. A
// day is final only once it has ended in UTC.
func DateFor(now time.Time, requested string) (string, error) {
	today := now.UTC().Truncate(24 * time.Hour)
	if requested == "" {
		return today.AddDate(0, 0, -1).Format(time.DateOnly), nil
	}
	d, err := time.Parse(time.DateOnly, requested)
	if err != nil {
		return "", fmt.Errorf("date %q isn't YYYY-MM-DD", requested)
	}
	if !d.Before(today) {
		return "", fmt.Errorf("date %s isn't final until it has ended in UTC", requested)
	}
	return requested, nil
}

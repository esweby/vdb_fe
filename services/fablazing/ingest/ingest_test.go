package ingest

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

const (
	apiKey    = "test-key-do-not-log"
	signature = "sig=signed-secret"
)

// fakeStore is an in-memory Store.
type fakeStore struct {
	objects map[string][]byte
	putErr  error
}

func (s *fakeStore) Exists(_ context.Context, key string) (bool, error) {
	_, ok := s.objects[key]
	return ok, nil
}

func (s *fakeStore) Put(_ context.Context, key string, body []byte) error {
	if s.putErr != nil {
		return s.putErr
	}
	s.objects[key] = body
	return nil
}

type fakeAggregator struct {
	calls []string
	err   error
}

func (a *fakeAggregator) Aggregate(_ context.Context, date string, format int, games []game.Game) error {
	guids := []string{}
	for _, g := range games {
		guids = append(guids, g.GUID)
	}
	a.calls = append(a.calls, fmt.Sprintf("%s/%d:%s", date, format, strings.Join(guids, ",")))
	return a.err
}

// fakeFaBlazing serves the API and the signed download. It records each API request.
type fakeFaBlazing struct {
	*httptest.Server
	apiCalls  []string
	apiStatus int
	csv       []byte
}

func newFakeFaBlazing(t *testing.T) *fakeFaBlazing {
	t.Helper()
	csv, err := os.ReadFile("testdata/day.csv")
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeFaBlazing{apiStatus: http.StatusOK, csv: csv}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/download_csv", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-functions-key") != apiKey {
			http.Error(w, "unauthorised", http.StatusUnauthorized)
			return
		}
		q := r.URL.Query()
		f.apiCalls = append(f.apiCalls, q.Get("date")+"/"+q.Get("format"))
		if f.apiStatus != http.StatusOK {
			w.WriteHeader(f.apiStatus)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{
			"download_url": f.URL + "/blob/" + q.Get("format") + ".csv?" + signature,
			"date":         q.Get("date"),
			"format":       q.Get("format"),
			"version":      "v1",
		})
	})
	mux.HandleFunc("/blob/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.RawQuery != signature {
			http.Error(w, "bad signature", http.StatusForbidden)
			return
		}
		w.Write(f.csv)
	})
	f.Server = httptest.NewServer(mux)
	t.Cleanup(f.Close)
	return f
}

func newIngester(t *testing.T, f *fakeFaBlazing, store *fakeStore, logs *bytes.Buffer) *Ingester {
	return &Ingester{
		BaseURL: f.URL,
		APIKey:  apiKey,
		Formats: []int{0, 1},
		HTTP:    f.Client(),
		Store:   store,
		TempDir: t.TempDir(),
		Logger:  slog.New(slog.NewJSONHandler(logs, nil)),
	}
}

func readNDJSON(t *testing.T, body []byte) []map[string]string {
	t.Helper()
	zr, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	var rows []map[string]string
	sc := bufio.NewScanner(zr)
	sc.Buffer(nil, 1<<20)
	for sc.Scan() {
		var row map[string]string
		if err := json.Unmarshal(sc.Bytes(), &row); err != nil {
			t.Fatalf("line %q: %v", sc.Text(), err)
		}
		rows = append(rows, row)
	}
	if err := sc.Err(); err != nil {
		t.Fatal(err)
	}
	return rows
}

func assertNoSecrets(t *testing.T, where, text string) {
	t.Helper()
	for _, s := range []string{apiKey, "signed-secret"} {
		if strings.Contains(text, s) {
			t.Errorf("%s contains a secret (%q): %s", where, s, text)
		}
	}
}

func TestRunWritesViseraiGamesAsGzippedNDJSON(t *testing.T) {
	f := newFakeFaBlazing(t)
	store := &fakeStore{objects: map[string][]byte{}}
	var logs bytes.Buffer
	in := newIngester(t, f, store, &logs)

	results, err := in.Run(context.Background(), "2026-10-20")
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(f.apiCalls, " "); got != "2026-10-20/0 2026-10-20/1" {
		t.Errorf("API calls = %q", got)
	}
	body, ok := store.objects["raw/date=2026-10-20/format=0.ndjson.gz"]
	if !ok {
		t.Fatalf("nothing written for format 0; keys: %v", keys(store.objects))
	}
	rows := readNDJSON(t, body)
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want the 2 Viserai games", len(rows))
	}
	// Whole raw rows: both sides, every column, the latest copy of a duplicate.
	if rows[0]["game_guid"] != "g-vis-first" || rows[1]["game_guid"] != "g-vis-second" {
		t.Errorf("guids = %s, %s", rows[0]["game_guid"], rows[1]["game_guid"])
	}
	if rows[1]["created_at"] != "2026-10-20 12:30:00.0" {
		t.Errorf("duplicate kept the copy from %s, want the latest", rows[1]["created_at"])
	}
	if !strings.Contains(rows[1]["deck1_json"], "'kano'") || !strings.Contains(rows[1]["deck2_json"], "viserai_usurper") {
		t.Errorf("opponent's side missing: %v", rows[1])
	}
	if len(rows[0]) != 15 {
		t.Errorf("row has %d columns, want all 15", len(rows[0]))
	}
	if _, ok := store.objects["raw/date=2026-10-20/format=1.ndjson.gz"]; !ok {
		t.Error("nothing written for format 1")
	}

	want := FormatResult{Format: 0, Rows: 4, Games: 3, Kept: 2, ViseraiSides: 2}
	if len(results) != 2 || results[0].Format != want.Format || results[0].Rows != want.Rows ||
		results[0].Games != want.Games || results[0].Kept != want.Kept || results[0].ViseraiSides != want.ViseraiSides {
		t.Errorf("results[0] = %+v, want counts %+v", results, want)
	}
	if !strings.Contains(logs.String(), `"kept":2`) {
		t.Errorf("logs don't report counts: %s", logs.String())
	}
	assertNoSecrets(t, "logs", logs.String())
}

func TestRunSkipsADayAlreadyStored(t *testing.T) {
	f := newFakeFaBlazing(t)
	store := &fakeStore{objects: map[string][]byte{"raw/date=2026-10-20/format=0.ndjson.gz": []byte("kept")}}
	var logs bytes.Buffer
	in := newIngester(t, f, store, &logs)

	results, err := in.Run(context.Background(), "2026-10-20")
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(f.apiCalls, " "); got != "2026-10-20/1" {
		t.Errorf("API calls = %q, want only format 1 (format 0 is already stored)", got)
	}
	if string(store.objects["raw/date=2026-10-20/format=0.ndjson.gz"]) != "kept" {
		t.Error("overwrote the stored day")
	}
	if !results[0].Skipped || results[1].Skipped {
		t.Errorf("results = %+v", results)
	}
}

// Matchups and the run summary cover every game, so the aggregator gets them
// all, while S3 keeps only the Viserai games.
func TestRunPassesEveryGameToTheAggregator(t *testing.T) {
	f := newFakeFaBlazing(t)
	store := &fakeStore{objects: map[string][]byte{}}
	agg := &fakeAggregator{}
	var logs bytes.Buffer
	in := newIngester(t, f, store, &logs)
	in.Formats = []int{0}
	in.Aggregator = agg

	if _, err := in.Run(context.Background(), "2026-10-20"); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(agg.calls, " "); got != "2026-10-20/0:g-vis-first,g-other,g-vis-second" {
		t.Errorf("aggregator calls = %q, want every game including g-other", got)
	}
	if rows := readNDJSON(t, store.objects["raw/date=2026-10-20/format=0.ndjson.gz"]); len(rows) != 2 {
		t.Errorf("stored %d raw rows, want only the 2 Viserai games", len(rows))
	}
}

// A day whose aggregates didn't reach Supabase isn't stored, so a rerun
// fetches it again rather than skipping it.
func TestRunDoesNotStoreADayTheAggregatorFailed(t *testing.T) {
	f := newFakeFaBlazing(t)
	store := &fakeStore{objects: map[string][]byte{}}
	var logs bytes.Buffer
	in := newIngester(t, f, store, &logs)
	in.Formats = []int{0}
	in.Aggregator = &fakeAggregator{err: fmt.Errorf("database down")}

	_, err := in.Run(context.Background(), "2026-10-20")
	if err == nil || !strings.Contains(err.Error(), "database down") {
		t.Fatalf("err = %v, want the aggregator's error", err)
	}
	if len(store.objects) != 0 {
		t.Errorf("stored %v, so a rerun would skip the day", keys(store.objects))
	}
}

func TestRunErrorsWithoutLeakingSecrets(t *testing.T) {
	t.Run("API error", func(t *testing.T) {
		f := newFakeFaBlazing(t)
		f.apiStatus = http.StatusInternalServerError
		store := &fakeStore{objects: map[string][]byte{}}
		var logs bytes.Buffer
		_, err := newIngester(t, f, store, &logs).Run(context.Background(), "2026-10-20")
		if err == nil || !strings.Contains(err.Error(), "500") {
			t.Fatalf("err = %v, want the status", err)
		}
		if len(store.objects) != 0 {
			t.Errorf("wrote %v", keys(store.objects))
		}
		assertNoSecrets(t, "error", err.Error())
		assertNoSecrets(t, "logs", logs.String())
	})
	t.Run("download fails", func(t *testing.T) {
		f := newFakeFaBlazing(t)
		store := &fakeStore{objects: map[string][]byte{}}
		var logs bytes.Buffer
		in := newIngester(t, f, store, &logs)
		// A client that can reach the API but not the signed URL's host.
		in.HTTP = &http.Client{Transport: refuseBlob{f.Client().Transport}}
		_, err := in.Run(context.Background(), "2026-10-20")
		if err == nil || !strings.Contains(err.Error(), "downloading") {
			t.Fatalf("err = %v, want a download error", err)
		}
		assertNoSecrets(t, "error", err.Error())
		assertNoSecrets(t, "logs", logs.String())
	})
	t.Run("store fails", func(t *testing.T) {
		f := newFakeFaBlazing(t)
		store := &fakeStore{objects: map[string][]byte{}, putErr: fmt.Errorf("access denied")}
		var logs bytes.Buffer
		_, err := newIngester(t, f, store, &logs).Run(context.Background(), "2026-10-20")
		if err == nil || !strings.Contains(err.Error(), "access denied") {
			t.Fatalf("err = %v", err)
		}
	})
	t.Run("date and format don't match the request", func(t *testing.T) {
		f := newFakeFaBlazing(t)
		store := &fakeStore{objects: map[string][]byte{}}
		var logs bytes.Buffer
		in := newIngester(t, f, store, &logs)
		mux := http.NewServeMux()
		mux.HandleFunc("/wrong/api/v1/download_csv", func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]string{"download_url": f.URL + "/blob/0.csv?" + signature, "date": "2026-10-21", "format": "0"})
		})
		srv := httptest.NewServer(mux)
		defer srv.Close()
		in.BaseURL = srv.URL + "/wrong"
		_, err := in.Run(context.Background(), "2026-10-20")
		if err == nil || !strings.Contains(err.Error(), "2026-10-21") {
			t.Fatalf("err = %v, want a mismatch", err)
		}
		if len(store.objects) != 0 {
			t.Errorf("wrote %v", keys(store.objects))
		}
	})
}

// refuseBlob fails every request for the signed file the way a network error would.
type refuseBlob struct{ next http.RoundTripper }

func (r refuseBlob) RoundTrip(req *http.Request) (*http.Response, error) {
	if strings.HasPrefix(req.URL.Path, "/blob/") {
		return nil, io.ErrUnexpectedEOF
	}
	return r.next.RoundTrip(req)
}

func TestDateFor(t *testing.T) {
	now := time.Date(2026, 10, 21, 10, 0, 0, 0, time.UTC)
	cases := []struct {
		requested, want, err string
	}{
		{"", "2026-10-20", ""},
		{"2026-10-01", "2026-10-01", ""},
		{"2026-10-21", "", "isn't final"},
		{"2026-10-22", "", "isn't final"},
		{"20/10/2026", "", "YYYY-MM-DD"},
	}
	for _, c := range cases {
		got, err := DateFor(now, c.requested)
		if c.err != "" {
			if err == nil || !strings.Contains(err.Error(), c.err) {
				t.Errorf("DateFor(%q) err = %v, want %q", c.requested, err, c.err)
			}
			continue
		}
		if err != nil || got != c.want {
			t.Errorf("DateFor(%q) = %q, %v; want %q", c.requested, got, err, c.want)
		}
	}
	// Just after midnight UTC, yesterday is final.
	late := time.Date(2026, 10, 21, 0, 5, 0, 0, time.FixedZone("BST", 3600))
	if got, _ := DateFor(late, ""); got != "2026-10-19" {
		t.Errorf("DateFor at 00:05 BST (23:05 UTC on the 20th) = %q, want 2026-10-19", got)
	}
}

func keys(m map[string][]byte) []string {
	out := []string{}
	for k := range m {
		out = append(out, k)
	}
	return out
}

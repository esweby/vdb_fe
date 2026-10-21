package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/esweby/vdb_fe/services/fablazing/aggregate"
	"github.com/esweby/vdb_fe/services/fablazing/ingest"
)

// day writes a file of the ingest test day's rows: the header and every row
// whose guid is listed.
func day(t *testing.T, dir, name string, guids ...string) {
	t.Helper()
	b, err := os.ReadFile("../../ingest/testdata/day.csv")
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.SplitAfter(string(b), "\n")
	out := lines[0]
	for _, l := range lines[1:] {
		for _, g := range guids {
			if strings.Contains(l, ","+g+",") {
				out += l
			}
		}
	}
	if err := os.WriteFile(filepath.Join(dir, name), []byte(out), 0o600); err != nil {
		t.Fatal(err)
	}
}

type fakeWriter struct {
	written []aggregate.Result
	err     func(aggregate.Result) error
}

func (w *fakeWriter) Write(_ context.Context, r aggregate.Result) error {
	if w.err != nil {
		if err := w.err(r); err != nil {
			return err
		}
	}
	w.written = append(w.written, r)
	return nil
}

func TestDaysListsTheFilesInOrder(t *testing.T) {
	dir := t.TempDir()
	for _, n := range []string{"format1_2026-09-22.csv", "format0_2026-09-22.csv", "format0_2026-09-21.csv", "notes.txt", "format2_2026-09-21.csv", "format0_2026-9-1.csv"} {
		os.WriteFile(filepath.Join(dir, n), nil, 0o600)
	}
	days, err := Days(dir, "", "")
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, d := range days {
		got = append(got, fmt.Sprintf("%s/%d", d.Date, d.Format))
	}
	if strings.Join(got, " ") != "2026-09-21/0 2026-09-22/0 2026-09-22/1" {
		t.Errorf("days = %v", got)
	}
	days, _ = Days(dir, "2026-09-22", "2026-09-22")
	if len(days) != 2 || days[0].Date != "2026-09-22" {
		t.Errorf("from/to: %+v", days)
	}
}

func TestLoadWritesViseraiOnlyDays(t *testing.T) {
	dir := t.TempDir()
	day(t, dir, "format0_2026-09-21.csv", "g-vis-first", "g-vis-second")
	days, err := Days(dir, "", "")
	if err != nil {
		t.Fatal(err)
	}
	w := &fakeWriter{}
	var out bytes.Buffer
	l := &Loader{Scope: ingest.ScopeViserai, Writer: w, Out: &out}
	if err := l.Load(context.Background(), days); err != nil {
		t.Fatal(err)
	}
	if len(w.written) != 1 {
		t.Fatalf("wrote %d days", len(w.written))
	}
	r := w.written[0]
	if r.Run.Date != "2026-09-21" || r.Run.Format != 0 || r.Run.Scope != ingest.ScopeViserai {
		t.Errorf("run = %+v", r.Run)
	}
	for _, m := range r.Matchups {
		if m.Hero != aggregate.Viserai {
			t.Errorf("wrote %s against %s", m.Hero, m.Opponent)
		}
	}
	if r.Run.ViseraiSides != 2 || len(r.Matchups) != 2 {
		t.Errorf("Viserai's rows missing: %+v", r.Run)
	}
	if !strings.Contains(out.String(), "2026-09-21") || strings.Contains(out.String(), "p1") {
		t.Errorf("output = %s", out.String())
	}
}

func TestLoadRefusesAFullFileAsViseraiOnly(t *testing.T) {
	dir := t.TempDir()
	day(t, dir, "format0_2026-09-21.csv", "g-vis-first", "g-other")
	days, _ := Days(dir, "", "")
	w := &fakeWriter{}
	l := &Loader{Scope: ingest.ScopeViserai, Writer: w, Out: &bytes.Buffer{}}
	if err := l.Load(context.Background(), days); err == nil || !strings.Contains(err.Error(), "without Viserai") {
		t.Fatalf("err = %v", err)
	}
	if len(w.written) != 0 {
		t.Error("wrote a day")
	}
}

func TestLoadWritesFullDaysWhole(t *testing.T) {
	dir := t.TempDir()
	day(t, dir, "format0_2026-10-20.csv", "g-vis-first", "g-other", "g-vis-second")
	days, _ := Days(dir, "", "")
	w := &fakeWriter{}
	l := &Loader{Scope: ingest.ScopeAll, Writer: w, Out: &bytes.Buffer{}}
	if err := l.Load(context.Background(), days); err != nil {
		t.Fatal(err)
	}
	r := w.written[0]
	if r.Run.Scope != "" || r.Run.Games != 3 {
		t.Errorf("run = %+v", r.Run)
	}
	found := false
	for _, m := range r.Matchups {
		found = found || m.Hero == "dorinthea"
	}
	if !found {
		t.Error("a full day lost the other heroes' matchups")
	}
}

func TestLoadSkipsDaysThatAlreadyHaveEveryGame(t *testing.T) {
	dir := t.TempDir()
	day(t, dir, "format0_2026-09-21.csv", "g-vis-first")
	day(t, dir, "format0_2026-09-22.csv", "g-vis-first")
	days, _ := Days(dir, "", "")
	w := &fakeWriter{err: func(r aggregate.Result) error {
		if r.Run.Date == "2026-09-21" {
			return fmt.Errorf("replacing the day: %w", &pgconn.PgError{Code: "FB001"})
		}
		return nil
	}}
	var out bytes.Buffer
	l := &Loader{Scope: ingest.ScopeViserai, Writer: w, Out: &out}
	if err := l.Load(context.Background(), days); err != nil {
		t.Fatal(err)
	}
	if len(w.written) != 1 || w.written[0].Run.Date != "2026-09-22" {
		t.Errorf("written = %d", len(w.written))
	}
	if !strings.Contains(out.String(), "kept") {
		t.Errorf("output doesn't say the full day was kept: %s", out.String())
	}
}

func TestLoadStopsOnAnError(t *testing.T) {
	dir := t.TempDir()
	day(t, dir, "format0_2026-09-21.csv", "g-vis-first")
	day(t, dir, "format0_2026-09-22.csv", "g-vis-first")
	days, _ := Days(dir, "", "")
	w := &fakeWriter{err: func(aggregate.Result) error { return errors.New("permission denied") }}
	l := &Loader{Scope: ingest.ScopeViserai, Writer: w, Out: &bytes.Buffer{}}
	err := l.Load(context.Background(), days)
	if err == nil || !strings.Contains(err.Error(), "2026-09-21") {
		t.Fatalf("err = %v", err)
	}
}

func TestLoadRefusesAGameFromAnotherFormat(t *testing.T) {
	dir := t.TempDir()
	day(t, dir, "format1_2026-09-21.csv", "g-vis-first") // the rows are format 0
	days, _ := Days(dir, "", "")
	l := &Loader{Scope: ingest.ScopeViserai, Writer: &fakeWriter{}, Out: &bytes.Buffer{}}
	if err := l.Load(context.Background(), days); err == nil {
		t.Fatal("loaded format 0 games as format 1")
	}
}

func TestLocalHost(t *testing.T) {
	for url, want := range map[string]bool{
		"postgres://postgres:postgres@127.0.0.1:54322/postgres":            true,
		"postgres://postgres:postgres@localhost:54322/postgres":            true,
		"postgres://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres": false,
		"postgres://u:127.0.0.1@pooler.supabase.com:5432/postgres":         false,
		"%zz": false,
	} {
		if got := localHost(url); got != want {
			t.Errorf("localHost(%q) = %v", url, got)
		}
	}
}

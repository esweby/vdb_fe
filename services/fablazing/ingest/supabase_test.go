package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/esweby/vdb_fe/services/fablazing/aggregate"
	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// fakeDB records each statement.
type fakeDB struct {
	sql    []string
	args   [][]any
	err    error
	closed bool
}

func (d *fakeDB) Exec(_ context.Context, sql string, args ...any) error {
	d.sql = append(d.sql, sql)
	d.args = append(d.args, args)
	return d.err
}

func (d *fakeDB) Close(context.Context) error {
	d.closed = true
	return nil
}

func dayGames(t *testing.T) []game.Game {
	t.Helper()
	f, err := os.Open("testdata/day.csv")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	games, err := game.ReadAll(f)
	if err != nil {
		t.Fatal(err)
	}
	return games
}

func TestSupabaseReplacesTheDayWithTheAggregates(t *testing.T) {
	db := &fakeDB{}
	var logs bytes.Buffer
	s := &Supabase{
		Connect: func(context.Context) (DB, error) { return db, nil },
		Logger:  slog.New(slog.NewJSONHandler(&logs, nil)),
	}
	games := dayGames(t)

	if err := s.Aggregate(context.Background(), "2026-10-20", 0, games); err != nil {
		t.Fatal(err)
	}
	if len(db.sql) != 1 || db.sql[0] != "select public.fablazing_replace_day($1::date, $2::smallint, $3::jsonb)" {
		t.Fatalf("statements = %q", db.sql)
	}
	args := db.args[0]
	if len(args) != 3 || args[0] != "2026-10-20" || args[1] != 0 {
		t.Fatalf("args = %v", args[:2])
	}
	// The payload is aggregate.Run's Result, with the shared cap and concession rule.
	want, err := aggregate.Run(games, aggregate.Options{Date: "2026-10-20", Format: 0, Concession: aggregate.Concession, PlayerCap: aggregate.PlayerCap})
	if err != nil {
		t.Fatal(err)
	}
	wantJSON, _ := json.Marshal(want)
	if got, _ := args[2].(string); got != string(wantJSON) {
		t.Errorf("payload = %s\nwant %s", got, wantJSON)
	}
	var payload aggregate.Result
	json.Unmarshal([]byte(args[2].(string)), &payload)
	// Every game: g-other (Dorinthea against Bravo) is in the matchups.
	if payload.Run.Games != 3 {
		t.Errorf("run.games = %d, want all 3", payload.Run.Games)
	}
	found := false
	for _, m := range payload.Matchups {
		if m.Hero == "dorinthea" && m.Opponent == "bravo" {
			found = true
		}
	}
	if !found {
		t.Errorf("no dorinthea/bravo matchup: %+v", payload.Matchups)
	}
	if !db.closed {
		t.Error("connection left open")
	}
	// Counts only: no payload and no player hashes in the logs.
	if !strings.Contains(logs.String(), `"games":3`) {
		t.Errorf("logs don't report counts: %s", logs.String())
	}
	for _, g := range games {
		for _, side := range g.Sides {
			if side.Player != "" && strings.Contains(logs.String(), string(side.Player)) {
				t.Errorf("logs contain a player hash: %s", logs.String())
			}
		}
	}
	if strings.Contains(logs.String(), `"matchups":[`) || strings.Contains(logs.String(), "dorinthea") {
		t.Errorf("logs contain the payload: %s", logs.String())
	}
}

func TestSupabaseErrors(t *testing.T) {
	t.Run("connecting", func(t *testing.T) {
		s := &Supabase{
			Connect: func(context.Context) (DB, error) { return nil, errors.New("no route to host") },
			Logger:  slog.New(slog.DiscardHandler),
		}
		err := s.Aggregate(context.Background(), "2026-10-20", 0, dayGames(t))
		if err == nil || !strings.Contains(err.Error(), "no route to host") {
			t.Fatalf("err = %v", err)
		}
	})
	t.Run("replacing", func(t *testing.T) {
		db := &fakeDB{err: errors.New("permission denied for function fablazing_replace_day")}
		s := &Supabase{
			Connect: func(context.Context) (DB, error) { return db, nil },
			Logger:  slog.New(slog.DiscardHandler),
		}
		err := s.Aggregate(context.Background(), "2026-10-20", 0, dayGames(t))
		if err == nil || !strings.Contains(err.Error(), "permission denied") {
			t.Fatalf("err = %v", err)
		}
		if !db.closed {
			t.Error("connection left open")
		}
	})
	t.Run("a game from another format", func(t *testing.T) {
		db := &fakeDB{}
		s := &Supabase{
			Connect: func(context.Context) (DB, error) { return db, nil },
			Logger:  slog.New(slog.DiscardHandler),
		}
		if err := s.Aggregate(context.Background(), "2026-10-20", 1, dayGames(t)); err == nil {
			t.Fatal("aggregated format 0 games as format 1")
		}
		if len(db.sql) != 0 {
			t.Errorf("wrote %q", db.sql)
		}
	})
}

func TestPostgresURLErrorsDoNotLeakThePassword(t *testing.T) {
	_, err := PostgresConnect("postgres://fablazing_ingest:hunter2-secret@%zz/postgres")(context.Background())
	if err == nil {
		t.Fatal("connected with a malformed URL")
	}
	if strings.Contains(err.Error(), "hunter2-secret") {
		t.Errorf("error leaks the password: %v", err)
	}
}

// TestSupabaseAgainstPostgres calls the real fablazing_replace_day as
// fablazing_ingest, inside a transaction it rolls back, so nothing is kept.
// It runs only against a local database:
//
//	FABLAZING_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
//	FABLAZING_TEST_MIGRATION=path/to/the/fablazing migration, if the database doesn't have it yet
func TestSupabaseAgainstPostgres(t *testing.T) {
	url := os.Getenv("FABLAZING_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("FABLAZING_TEST_DATABASE_URL isn't set")
	}
	if !strings.Contains(url, "127.0.0.1") && !strings.Contains(url, "localhost") {
		t.Fatal("only a local database: never the hosted one")
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if m := os.Getenv("FABLAZING_TEST_MIGRATION"); m != "" {
		sql, err := os.ReadFile(m)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("applying the migration: %v", err)
		}
	}
	if _, err := tx.Exec(ctx, "set local role fablazing_ingest"); err != nil {
		t.Fatal(err)
	}
	s := &Supabase{
		Connect: func(context.Context) (DB, error) { return txDB{tx}, nil },
		Logger:  slog.New(slog.DiscardHandler),
	}
	// Twice: the second run replaces the first.
	for range 2 {
		if err := s.Aggregate(ctx, "2026-10-20", 0, dayGames(t)); err != nil {
			t.Fatal(err)
		}
	}
	var games, matchups int
	var status string
	if err := tx.QueryRow(ctx, "select status, games from public.fablazing_runs where date = '2026-10-20' and format = 0").Scan(&status, &games); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, "select count(*) from public.fablazing_matchup_daily where date = '2026-10-20' and format = 0").Scan(&matchups); err != nil {
		t.Fatal(err)
	}
	if status != "succeeded" || games != 3 {
		t.Errorf("run = %s, %d games; want succeeded, 3", status, games)
	}
	if matchups == 0 {
		t.Error("no matchup rows")
	}
}

// txDB runs statements in the test's transaction, the way pgConn does on a connection.
type txDB struct{ tx pgx.Tx }

func (d txDB) Exec(ctx context.Context, sql string, args ...any) error {
	_, err := d.tx.Exec(ctx, sql, args...)
	return err
}

func (d txDB) Close(context.Context) error { return nil }

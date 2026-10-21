package ingest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/esweby/vdb_fe/services/fablazing/aggregate"
)

func TestRunOptionsAreTheLambdas(t *testing.T) {
	o := RunOptions("2026-09-21", 1)
	want := aggregate.Options{Date: "2026-09-21", Format: 1, Concession: aggregate.Concession, PlayerCap: aggregate.PlayerCap}
	if o != want {
		t.Errorf("options = %+v, want %+v", o, want)
	}
}

func TestViseraiOnlyKeepsViseraisOwnMatchups(t *testing.T) {
	r, err := aggregate.Run(dayGames(t), RunOptions("2026-10-20", 0))
	if err != nil {
		t.Fatal(err)
	}
	v := ViseraiOnly(r)
	if v.Run.Scope != ScopeViserai {
		t.Errorf("scope = %q, want %q", v.Run.Scope, ScopeViserai)
	}
	if len(v.Matchups) == 0 {
		t.Fatal("no matchups left")
	}
	for _, m := range v.Matchups {
		if m.Hero != aggregate.Viserai {
			t.Errorf("kept %s against %s", m.Hero, m.Opponent)
		}
	}
	// Viserai's own rows are untouched.
	if len(v.Cards) != len(r.Cards) || len(v.Turns) != len(r.Turns) || len(v.Traverses) != len(r.Traverses) {
		t.Errorf("Viserai's rows changed: %d/%d cards, %d/%d turns, %d/%d traverses",
			len(v.Cards), len(r.Cards), len(v.Turns), len(r.Turns), len(v.Traverses), len(r.Traverses))
	}
	// The input isn't changed.
	if r.Run.Scope != "" {
		t.Errorf("the input's scope = %q", r.Run.Scope)
	}
	found := false
	for _, m := range r.Matchups {
		if m.Hero == "dorinthea" {
			found = true
		}
	}
	if !found {
		t.Error("the input lost its other matchups")
	}
}

func TestSupabaseWritesAResult(t *testing.T) {
	db := &fakeDB{}
	s := &Supabase{Connect: func(context.Context) (DB, error) { return db, nil }, Logger: slog.New(slog.DiscardHandler)}
	r, err := aggregate.Run(dayGames(t), RunOptions("2026-10-20", 0))
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Write(context.Background(), ViseraiOnly(r)); err != nil {
		t.Fatal(err)
	}
	if len(db.sql) != 1 || db.sql[0] != ReplaceDay {
		t.Fatalf("statements = %q", db.sql)
	}
	args := db.args[0]
	if args[0] != "2026-10-20" || args[1] != 0 {
		t.Errorf("args = %v", args[:2])
	}
	payload := args[2].(string)
	if !strings.Contains(payload, `"scope":"viserai"`) {
		t.Errorf("payload has no Viserai-only scope: %s", payload)
	}
	if strings.Contains(payload, `"hero":"dorinthea"`) {
		t.Errorf("payload has another hero's matchups: %s", payload)
	}
	if !db.closed {
		t.Error("connection left open")
	}
}

func TestTheLambdaSendsNoScope(t *testing.T) {
	db := &fakeDB{}
	s := &Supabase{Connect: func(context.Context) (DB, error) { return db, nil }, Logger: slog.New(slog.DiscardHandler)}
	if err := s.Aggregate(context.Background(), "2026-10-20", 0, dayGames(t)); err != nil {
		t.Fatal(err)
	}
	var p struct {
		Run map[string]any `json:"run"`
	}
	if err := json.Unmarshal([]byte(db.args[0][2].(string)), &p); err != nil {
		t.Fatal(err)
	}
	if _, ok := p.Run["scope"]; ok {
		t.Errorf("the daily run sends a scope: %v", p.Run["scope"])
	}
}

func TestIsFullDayKept(t *testing.T) {
	kept := fmt.Errorf("replacing the day: %w", &pgconn.PgError{Code: "FB001"})
	if !IsFullDayKept(kept) {
		t.Error("FB001 isn't recognised")
	}
	if IsFullDayKept(fmt.Errorf("replacing the day: %w", &pgconn.PgError{Code: "23514"})) || IsFullDayKept(errors.New("FB001")) || IsFullDayKept(nil) {
		t.Error("another error is taken for a kept full day")
	}
}

// TestViseraiOnlyAgainstPostgres loads a Viserai-only day, then the same day
// with every game, against the local database (see TestSupabaseAgainstPostgres).
func TestViseraiOnlyAgainstPostgres(t *testing.T) {
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
	if _, err := tx.Exec(ctx, "set local role fablazing_ingest"); err != nil {
		t.Fatal(err)
	}
	s := &Supabase{Connect: func(context.Context) (DB, error) { return txDB{tx}, nil }, Logger: slog.New(slog.DiscardHandler)}
	r, err := aggregate.Run(dayGames(t), RunOptions("2026-10-20", 0))
	if err != nil {
		t.Fatal(err)
	}

	if err := s.Write(ctx, ViseraiOnly(r)); err != nil {
		t.Fatal(err)
	}
	var scope string
	var others int
	if err := tx.QueryRow(ctx, "select scope from public.fablazing_runs where date = '2026-10-20' and format = 0").Scan(&scope); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, "select count(*) from public.fablazing_matchup_daily where date = '2026-10-20' and format = 0 and hero <> 'viserai'").Scan(&others); err != nil {
		t.Fatal(err)
	}
	if scope != ScopeViserai || others != 0 {
		t.Errorf("Viserai-only day: scope %q, %d other heroes' matchups", scope, others)
	}

	if err := s.Write(ctx, r); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, "select scope from public.fablazing_runs where date = '2026-10-20' and format = 0").Scan(&scope); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, "select count(*) from public.fablazing_matchup_daily where date = '2026-10-20' and format = 0 and hero <> 'viserai'").Scan(&others); err != nil {
		t.Fatal(err)
	}
	if scope != ScopeAll || others == 0 {
		t.Errorf("full day: scope %q, %d other heroes' matchups", scope, others)
	}

	// Savepoint: the refused write aborts only itself.
	if _, err := tx.Exec(ctx, "savepoint before_refusal"); err != nil {
		t.Fatal(err)
	}
	err = s.Write(ctx, ViseraiOnly(r))
	if !IsFullDayKept(err) {
		t.Fatalf("a Viserai-only day over a full one: err = %v", err)
	}
}

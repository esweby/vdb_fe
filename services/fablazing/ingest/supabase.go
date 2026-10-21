package ingest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"

	"github.com/esweby/vdb_fe/services/fablazing/aggregate"
	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// ReplaceDay replaces one date and format whole, in one transaction
// (supabase/migrations/20261021120000_fablazing.sql).
const ReplaceDay = "select public.fablazing_replace_day($1::date, $2::smallint, $3::jsonb)"

// DB is one connection to Supabase as the fablazing_ingest role.
type DB interface {
	Exec(ctx context.Context, sql string, args ...any) error
	Close(ctx context.Context) error
}

// Supabase is the Aggregator that writes each day and format's aggregates
// through fablazing_replace_day. It logs counts only: never the payload or a
// player hash (the payload carries none).
type Supabase struct {
	Connect func(ctx context.Context) (DB, error)
	Logger  *slog.Logger
}

func (s *Supabase) Aggregate(ctx context.Context, date string, format int, games []game.Game) error {
	r, err := aggregate.Run(games, RunOptions(date, format))
	if err != nil {
		return err
	}
	return s.Write(ctx, r)
}

// Write replaces r's date and format with its rows.
func (s *Supabase) Write(ctx context.Context, r aggregate.Result) error {
	date, format := r.Run.Date, r.Run.Format
	payload, err := json.Marshal(r)
	if err != nil {
		return err
	}
	db, err := s.Connect(ctx)
	if err != nil {
		return fmt.Errorf("connecting to Supabase: %w", err)
	}
	defer db.Close(ctx)
	if err := db.Exec(ctx, ReplaceDay, date, format, string(payload)); err != nil {
		return fmt.Errorf("replacing the day: %w", err)
	}
	s.Logger.Info("aggregates written", "date", date, "format", format, "scope", r.Run.Scope,
		"games", r.Run.Games, "abandoned", r.Run.Abandoned, "sides", r.Run.Sides,
		"viserai_sides", r.Run.ViseraiSides, "capped_sides", r.Run.CappedSides,
		"card_rows", len(r.Cards), "matchup_rows", len(r.Matchups),
		"turn_rows", len(r.Turns), "traverse_rows", len(r.Traverses))
	return nil
}

// PostgresConnect connects with a Postgres URL, such as Supabase's session
// pooler as fablazing_ingest. Errors never carry the URL.
func PostgresConnect(url string) func(ctx context.Context) (DB, error) {
	return func(ctx context.Context) (DB, error) {
		cfg, err := pgx.ParseConfig(url)
		if err != nil {
			return nil, errors.New("the database URL isn't a valid Postgres URL")
		}
		// No prepared statements, so a transaction pooler works too.
		cfg.DefaultQueryExecMode = pgx.QueryExecModeExec
		conn, err := pgx.ConnectConfig(ctx, cfg)
		if err != nil {
			return nil, err
		}
		return pgConn{conn}, nil
	}
}

type pgConn struct{ c *pgx.Conn }

func (p pgConn) Exec(ctx context.Context, sql string, args ...any) error {
	_, err := p.c.Exec(ctx, sql, args...)
	return err
}

func (p pgConn) Close(ctx context.Context) error { return p.c.Close(ctx) }

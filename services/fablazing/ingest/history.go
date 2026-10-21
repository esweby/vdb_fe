package ingest

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/esweby/vdb_fe/services/fablazing/aggregate"
)

// A run's scope (fablazing_runs.scope): every game of the day, or only the
// games with Viserai on either side, as in the history files fetched before
// the daily ingest began.
const (
	ScopeAll     = "all"
	ScopeViserai = "viserai"
)

// RunOptions are the aggregator's options for a day: the shared player cap
// and concession rule.
func RunOptions(date string, format int) aggregate.Options {
	return aggregate.Options{Date: date, Format: format, Concession: aggregate.Concession, PlayerCap: aggregate.PlayerCap}
}

// ViseraiOnly marks a Result built from Viserai's games only and keeps only
// Viserai's own matchups: other heroes' would be partial. Viserai's cards,
// turns and traverses are whole. r is not changed.
func ViseraiOnly(r aggregate.Result) aggregate.Result {
	r.Run.Scope = ScopeViserai
	matchups := make([]aggregate.MatchupDaily, 0, len(r.Matchups))
	for _, m := range r.Matchups {
		if m.Hero == aggregate.Viserai {
			matchups = append(matchups, m)
		}
	}
	r.Matchups = matchups
	return r
}

// IsFullDayKept reports whether fablazing_replace_day refused a Viserai-only
// day because that day already has every game (FB001).
func IsFullDayKept(err error) bool {
	var pe *pgconn.PgError
	return errors.As(err, &pe) && pe.Code == "FB001"
}

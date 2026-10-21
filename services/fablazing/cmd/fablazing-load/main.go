// Command fablazing-load writes FaBlazing days from local CSVs to Supabase,
// the way the daily Lambda does: aggregate.Run with the shared options, then
// fablazing_replace_day as the fablazing_ingest role. It loads history from
// before the daily ingest began (docs/fablazing-plan.md, "Next steps" 3).
//
//	fablazing-load -scope viserai|all [-dir d] [-from YYYY-MM-DD] [-to YYYY-MM-DD] [-dry-run] [-yes-remote]
//
// Files are named format{0,1}_YYYY-MM-DD.csv. With -scope viserai every game
// in them must have Viserai on a side: the day is written with Viserai's
// cards, turns, traverses and Viserai's own matchups only, and recorded as
// Viserai-only. A day that already has every game is kept, not replaced.
// With -scope all the files are FaBlazing's whole day and written whole.
//
// The database URL comes from DB_URL. Only a local host is used unless
// -yes-remote is given. It prints counts only: never the URL, a player hash
// or the payload.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"

	"github.com/esweby/vdb_fe/services/fablazing/aggregate"
	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/ingest"
)

// Day is one date and format's file.
type Day struct {
	Date   string
	Format int
	Path   string
}

var dayName = regexp.MustCompile(`^format([01])_(\d{4}-\d{2}-\d{2})\.csv$`)

// Days lists dir's day files from from to to (inclusive; "" for no bound),
// by date then format.
func Days(dir, from, to string) ([]Day, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var days []Day
	for _, e := range entries {
		m := dayName.FindStringSubmatch(e.Name())
		if m == nil || e.IsDir() {
			continue
		}
		if (from != "" && m[2] < from) || (to != "" && m[2] > to) {
			continue
		}
		f, _ := strconv.Atoi(m[1])
		days = append(days, Day{Date: m[2], Format: f, Path: filepath.Join(dir, e.Name())})
	}
	sort.Slice(days, func(i, j int) bool {
		if days[i].Date != days[j].Date {
			return days[i].Date < days[j].Date
		}
		return days[i].Format < days[j].Format
	})
	return days, nil
}

// Writer writes one day's Result; ingest.Supabase is the real one.
type Writer interface {
	Write(ctx context.Context, r aggregate.Result) error
}

// Loader aggregates and writes days. A nil Writer is a dry run.
type Loader struct {
	Scope  string // ingest.ScopeViserai or ingest.ScopeAll
	Writer Writer
	Out    io.Writer
}

// Load writes each day in turn and stops at the first error.
func (l *Loader) Load(ctx context.Context, days []Day) error {
	if l.Scope != ingest.ScopeViserai && l.Scope != ingest.ScopeAll {
		return fmt.Errorf("scope %q isn't %s or %s", l.Scope, ingest.ScopeViserai, ingest.ScopeAll)
	}
	fmt.Fprintln(l.Out, "date\tformat\tgames\tviserai_sides\tcapped\tcards\tmatchups\tturns\ttraverses\tresult")
	for _, d := range days {
		r, err := l.aggregate(d)
		if err != nil {
			return fmt.Errorf("%s format %d: %w", d.Date, d.Format, err)
		}
		result := "dry run"
		if l.Writer != nil {
			result = "written"
			if err := l.Writer.Write(ctx, r); ingest.IsFullDayKept(err) {
				result = "kept: the day already has every game"
			} else if err != nil {
				return fmt.Errorf("%s format %d: %w", d.Date, d.Format, err)
			}
		}
		fmt.Fprintf(l.Out, "%s\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%s\n", d.Date, d.Format, r.Run.Games, r.Run.ViseraiSides,
			r.Run.CappedSides, len(r.Cards), len(r.Matchups), len(r.Turns), len(r.Traverses), result)
	}
	return nil
}

func (l *Loader) aggregate(d Day) (aggregate.Result, error) {
	f, err := os.Open(d.Path)
	if err != nil {
		return aggregate.Result{}, err
	}
	defer f.Close()
	games, err := game.ReadAll(f)
	if err != nil {
		return aggregate.Result{}, fmt.Errorf("parsing: %w", err)
	}
	if l.Scope == ingest.ScopeViserai {
		for _, g := range games {
			if !hasViserai(g) {
				return aggregate.Result{}, fmt.Errorf("game %s is without Viserai: is this a whole day's file?", g.GUID)
			}
		}
	}
	r, err := aggregate.Run(games, ingest.RunOptions(d.Date, d.Format))
	if err != nil {
		return aggregate.Result{}, err
	}
	if l.Scope == ingest.ScopeViserai {
		r = ingest.ViseraiOnly(r)
	}
	return r, nil
}

func hasViserai(g game.Game) bool {
	for _, s := range g.Sides {
		if game.IsViserai(s.Hero) {
			return true
		}
	}
	return false
}

// localHost reports whether a Postgres URL points at this machine.
func localHost(dbURL string) bool {
	u, err := url.Parse(dbURL)
	if err != nil {
		return false
	}
	h := u.Hostname()
	return h == "127.0.0.1" || h == "localhost" || h == "::1"
}

// discard: the table on stdout reports each day.
var discard = slog.New(slog.DiscardHandler)

func main() {
	home, _ := os.UserHomeDir()
	dir := flag.String("dir", filepath.Join(home, ".cache/vdb/fablazing/viserai"), "the folder of format{0,1}_YYYY-MM-DD.csv files")
	scope := flag.String("scope", "", "viserai (files of Viserai's games only) or all (FaBlazing's whole day)")
	from := flag.String("from", "", "first date, YYYY-MM-DD")
	to := flag.String("to", "", "last date, YYYY-MM-DD")
	dry := flag.Bool("dry-run", false, "aggregate and print the counts without writing")
	remote := flag.Bool("yes-remote", false, "allow a database that isn't on this machine")
	flag.Parse()
	if err := run(*dir, *scope, *from, *to, *dry, *remote); err != nil {
		fmt.Fprintln(os.Stderr, "fablazing-load:", err)
		os.Exit(1)
	}
}

func run(dir, scope, from, to string, dry, remote bool) error {
	ctx := context.Background()
	days, err := Days(dir, from, to)
	if err != nil {
		return err
	}
	if len(days) == 0 {
		return errors.New("no day files to load")
	}
	l := &Loader{Scope: scope, Out: os.Stdout}
	if !dry {
		dbURL := os.Getenv("DB_URL")
		if dbURL == "" {
			return errors.New("DB_URL isn't set")
		}
		if !localHost(dbURL) && !remote {
			return errors.New("DB_URL isn't on this machine: pass -yes-remote to write to it")
		}
		s := &ingest.Supabase{Connect: ingest.PostgresConnect(dbURL), Logger: discard}
		// The scope column comes with the history migration; without it a
		// Viserai-only day would be recorded as a whole one.
		db, err := s.Connect(ctx)
		if err != nil {
			return fmt.Errorf("connecting: %w", err)
		}
		err = db.Exec(ctx, "select scope from public.fablazing_runs limit 0")
		db.Close(ctx)
		if err != nil {
			return fmt.Errorf("the database doesn't have fablazing_runs.scope yet: %w", err)
		}
		l.Writer = s
	}
	return l.Load(ctx, days)
}

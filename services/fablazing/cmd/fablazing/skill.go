package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/esweby/vdb_fe/services/fablazing/archetypes"
	"github.com/esweby/vdb_fe/services/fablazing/ceiling"
	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/ingest"
	"github.com/esweby/vdb_fe/services/fablazing/skill"
)

func sidesDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".cache/vdb/fablazing/sides")
}

// runFetchSides fetches whole days from FaBlazing and keeps one small row per
// kept side, every hero, deleting the day's CSV after. A day already fetched
// is skipped. The API key is read from FABLAZING_API_KEY and never printed.
// Given whole-day CSVs already on disk (format<n>_<date>.csv), it summarises
// those instead.
func runFetchSides(args []string) error {
	fs := flag.NewFlagSet("fetch-sides", flag.ContinueOnError)
	from := fs.String("from", "", "first date, YYYY-MM-DD")
	to := fs.String("to", "", "last date, YYYY-MM-DD")
	dir := fs.String("dir", sidesDir(), "where the rows go")
	capN := fs.Int("cap", playerCap, "most sides one player contributes per day and format (0 for no cap)")
	minTurns := fs.Int("min-turns", 4, "fewest turn indexes a side needs to count")
	if err := fs.Parse(args); err != nil {
		return err
	}
	o := archetypes.Options{MinTurns: *minTurns, Concession: concession, PlayerCap: *capN}
	if err := os.MkdirAll(*dir, 0o755); err != nil {
		return err
	}
	if fs.NArg() > 0 {
		for _, path := range fs.Args() {
			var format int
			var date string
			if _, err := fmt.Sscanf(filepath.Base(path), "format%d_%10s", &format, &date); err != nil {
				return fmt.Errorf("%s: want format<n>_<date>.csv", path)
			}
			f, err := os.Open(path)
			if err != nil {
				return err
			}
			n, err := summarise(f, date, format, o, filepath.Join(*dir, fmt.Sprintf("format%d_%s.csv", format, date)))
			f.Close()
			if err != nil {
				return fmt.Errorf("%s: %w", path, err)
			}
			fmt.Fprintf(os.Stderr, "%s format %d: %d kept sides\n", date, format, n)
		}
		return nil
	}
	key := os.Getenv("FABLAZING_API_KEY")
	if key == "" {
		return errors.New("FABLAZING_API_KEY is not set")
	}
	start, err1 := time.Parse(time.DateOnly, *from)
	end, err2 := time.Parse(time.DateOnly, *to)
	if err1 != nil || err2 != nil || end.Before(start) {
		return errors.New("-from and -to must be dates, from first")
	}
	in := &ingest.Ingester{BaseURL: "https://fab-insights.azurewebsites.net", APIKey: key, HTTP: &http.Client{Timeout: 10 * time.Minute},
		Logger: slog.New(slog.NewTextHandler(os.Stderr, nil))}
	var failed []string
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		date := d.Format(time.DateOnly)
		for _, format := range []int{0, 1} {
			out := filepath.Join(*dir, fmt.Sprintf("format%d_%s.csv", format, date))
			if _, err := os.Stat(out); err == nil {
				continue
			}
			n, err := fetchDay(in, date, format, o, out)
			if err != nil {
				// FaBlazing answers 500 for some days; skip them and say which.
				fmt.Fprintf(os.Stderr, "%s format %d: %v\n", date, format, err)
				failed = append(failed, fmt.Sprintf("%s/%d", date, format))
				continue
			}
			fmt.Fprintf(os.Stderr, "%s format %d: %d kept sides\n", date, format, n)
		}
	}
	if len(failed) > 0 {
		return fmt.Errorf("%d day-formats failed, rerun to retry: %v", len(failed), failed)
	}
	return nil
}

func fetchDay(in *ingest.Ingester, date string, format int, o archetypes.Options, out string) (int, error) {
	tmp, err := os.CreateTemp("", "fablazing-day-*.csv")
	if err != nil {
		return 0, err
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()
	if err := in.Fetch(context.Background(), date, format, tmp); err != nil {
		return 0, err
	}
	if _, err := tmp.Seek(0, 0); err != nil {
		return 0, err
	}
	return summarise(tmp, date, format, o, out)
}

// summarise writes a whole day's kept sides as rows to out.
func summarise(r io.Reader, date string, format int, o archetypes.Options, out string) (int, error) {
	games, err := game.ReadAll(r)
	if err != nil {
		return 0, fmt.Errorf("parsing: %w", err)
	}
	var rows []skill.Row
	for _, s := range archetypes.KeptAny(games, o) {
		rows = append(rows, skill.Row{Date: date, Format: format, Player: s.Player, Hero: s.Hero, Opponent: s.Opponent, Won: s.Won, Fatigue: s.Fatigue})
	}
	part := out + ".part"
	f, err := os.Create(part)
	if err != nil {
		return 0, err
	}
	if err := skill.WriteRows(f, rows); err != nil {
		f.Close()
		return 0, err
	}
	if err := f.Close(); err != nil {
		return 0, err
	}
	return len(rows), os.Rename(part, out)
}

// runSkill compares each Viserai player's record with their other heroes'
// (UNVERIFIED). Viserai sides come from the Viserai CSVs, with block slop and
// fatigue set apart as in ceiling; other heroes from fetch-sides' rows.
func runSkill(args []string) error {
	fs := flag.NewFlagSet("skill", flag.ContinueOnError)
	capN := fs.Int("cap", playerCap, "most sides one player contributes per day and format (0 for no cap)")
	dir := fs.String("sides", sidesDir(), "fetch-sides' rows")
	minEach := fs.Int("min-each", 20, "fewest sides on Viserai and on other heroes before a player counts")
	minGames := fs.Int("min-games", 50, "fewest Viserai sides before a pilot is listed")
	top := fs.Int("top", 10, "pilots to print")
	k := fs.Int("k", 8, "archetypes to look for")
	seed := fs.Uint64("seed", 1, "clustering and bootstrap seed")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() == 0 {
		return errors.New("skill needs at least one Viserai CSV")
	}
	var games []game.Game
	for _, path := range fs.Args() {
		g, err := read(path)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		games = append(games, g...)
	}
	paths, err := filepath.Glob(filepath.Join(*dir, "format*_*.csv"))
	if err != nil || len(paths) == 0 {
		return fmt.Errorf("no rows in %s: run fetch-sides first", *dir)
	}
	dates := map[string]bool{}
	var others []game.Side
	for _, p := range paths {
		f, err := os.Open(p)
		if err != nil {
			return err
		}
		rows, err := skill.ReadRows(f)
		f.Close()
		if err != nil {
			return fmt.Errorf("%s: %w", p, err)
		}
		for _, r := range rows {
			dates[fmt.Sprintf("%s/%d", r.Date, r.Format)] = true
			if !r.Fatigue && !game.IsViserai(r.Hero) {
				others = append(others, r.Side())
			}
		}
	}

	o := archetypes.Options{MinTurns: 4, Concession: concession, PlayerCap: *capN, K: *k, MinShare: 0.02, MinSample: minSample, Seed: *seed}
	r := archetypes.Compute(games, o)
	slop := ceiling.BlockSlopArchetype(r, ceiling.BlockSlopMarkers)
	kept := map[string]bool{}
	for _, g := range games {
		if dates[fmt.Sprintf("%s/%d", g.CreatedAt[:min(10, len(g.CreatedAt))], g.Format)] {
			kept[g.GUID] = true
		}
	}
	var sub []game.Game
	for _, g := range games {
		if kept[g.GUID] {
			sub = append(sub, g)
		}
	}
	split := ceiling.Split(archetypes.Kept(sub, o), func(s game.Side) bool { return r.Nearest(archetypes.ListOf(s)) == slop })
	players := skill.Records(split.Main, others)

	fmt.Printf("UNVERIFIED. %d day-formats of whole files; %d Viserai sides without block slop or fatigue on those days, %d other-hero sides.\n", len(dates), len(split.Main), len(others))
	fmt.Println("(associations, not causes: other heroes face a different field)")
	g := skill.Paired(players, *minEach, 2000, *seed)
	fmt.Printf("\nplayers with %d+ sides on both: %d\n", *minEach, g.Players)
	fmt.Printf("  mean Viserai %.1f%%, mean other heroes %.1f%%, gap %+.1f points [%+.1f to %+.1f]\n", 100*g.Viserai, 100*g.Other, 100*g.Gap, 100*g.Low, 100*g.High)

	fmt.Println("\nViserai by the player's other-hero win rate:")
	fmt.Println("  other heroes  players  Viserai by side        Viserai by player")
	for _, b := range skill.Bands(players, *minEach, []float64{0.4, 0.5, 0.55, 0.6, 0.65}) {
		if b.Players == 0 {
			fmt.Printf("  %3.0f-%3.0f%%     %7d\n", 100*b.From, 100*b.To, 0)
			continue
		}
		fmt.Printf("  %3.0f-%3.0f%%     %7d  %-22s %5.1f%%\n", 100*b.From, 100*b.To, b.Players, rate(b.Viserai.Wins, b.Viserai.Games), 100*b.PlayerRate)
	}

	byPlayer := map[game.PlayerHash]skill.Player{}
	for _, p := range players {
		byPlayer[p.Player] = p
	}
	fmt.Printf("\ntop pilots (%d+ Viserai sides on these days), their other heroes:\n", *minGames)
	fmt.Println("  rank  Viserai          other heroes")
	for i, p := range ceiling.Pilots(split.Main, *minGames) {
		if i == *top {
			break
		}
		q := byPlayer[p.Player]
		other := "none"
		if q.Other.Games > 0 {
			other = rate(q.Other.Wins, q.Other.Games)
		}
		fmt.Printf("  %4d  %5.1f%% (n=%3d)  %s\n", i+1, 100*p.Rate, p.Games, other)
	}
	return nil
}

package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/esweby/vdb_fe/services/fablazing/archetypes"
	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// readList reads a list file: "<copies> <card id>" lines, then the sideboard
// after a "sideboard" line. Blank lines and # comments are skipped.
func readList(r io.Reader) (main, side map[string]int, err error) {
	main, side = map[string]int{}, map[string]int{}
	into := main
	sc := bufio.NewScanner(r)
	for n := 1; sc.Scan(); n++ {
		line := strings.TrimSpace(sc.Text())
		switch {
		case line == "" || strings.HasPrefix(line, "#"):
			continue
		case line == "sideboard":
			into = side
			continue
		}
		count, id, ok := strings.Cut(line, " ")
		copies, err := strconv.Atoi(count)
		if !ok || err != nil {
			return nil, nil, fmt.Errorf("line %d: want \"<copies> <card id>\", got %q", n, line)
		}
		into[strings.TrimSpace(id)] += copies
	}
	return main, side, sc.Err()
}

// runLike places a list among the archetypes and finds the real lists like it
// (UNVERIFIED thresholds), comparing their turns with each archetype's.
func runLike(args []string) error {
	fs := flag.NewFlagSet("like", flag.ContinueOnError)
	capN := fs.Int("cap", playerCap, "most sides one player contributes per day and format (0 for no cap)")
	k := fs.Int("k", 8, "archetypes to look for")
	min := fs.Float64("min", 0.6, "similarity (shared cards over all cards) a lookalike needs")
	brick := fs.Int("brick", 5, "a turn threatening under this is a brick")
	big := fs.Int("big", 14, "a turn threatening this or more is big")
	peak := fs.Int("peak", 18, "a side whose best turn reaches this has a high ceiling")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() < 2 {
		return fmt.Errorf("like needs a list file and at least one CSV")
	}
	f, err := os.Open(fs.Arg(0))
	if err != nil {
		return err
	}
	main, _, err := readList(f)
	f.Close()
	if err != nil {
		return fmt.Errorf("%s: %w", fs.Arg(0), err)
	}
	target := map[string]bool{}
	for id := range main {
		target[id] = true
	}
	var games []game.Game
	for _, path := range fs.Args()[1:] {
		g, err := read(path)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		games = append(games, g...)
	}
	po := archetypes.ProfileOptions{Rounds: 4, Brick: *brick, Big: *big, Peak: *peak, Usurp: "usurp_the_shadow_throne_blue"}
	o := archetypes.Options{MinTurns: 4, Concession: concession, PlayerCap: *capN, K: *k, MinShare: 0.02, MinSample: minSample, Seed: 1, Profile: po}
	r := archetypes.Compute(games, o)

	fmt.Printf("UNVERIFIED: brick = under %d threatened, big = %d+, peak = best own turn %d+, over own turns 1-4. Usurp = played Usurp the Shadow Throne any time.\n", *brick, *big, *peak)
	fmt.Println("(associations, not causes)")
	fmt.Printf("\nthe list (%d main deck cards) sits nearest archetype %d\n", len(target), r.Nearest(target)+1)
	fmt.Println("\nkept sides by similarity to the list's main deck:")
	for _, at := range []float64{0.5, 0.6, 0.7, 0.8} {
		fmt.Printf("  %.0f%%+  %d\n", 100*at, len(archetypes.Lookalikes(games, target, o, at)))
	}

	like := archetypes.Lookalikes(games, target, o, *min)
	type group struct {
		label   string
		players int
		p       archetypes.ProfileTally
		sides   []game.Side // nil for an archetype
	}
	profile := func(label string, sides []game.Side) group {
		players := map[game.PlayerHash]bool{}
		for _, s := range sides {
			players[s.Player] = true
		}
		return group{label, len(players), archetypes.Profile(sides, po), sides}
	}
	byUsurp := map[string][]game.Side{}
	for _, s := range like {
		switch n := archetypes.Copies(s, po.Usurp); {
		case n >= 3:
			byUsurp["3"] = append(byUsurp["3"], s)
		case n > 0:
			byUsurp["1-2"] = append(byUsurp["1-2"], s)
		default:
			byUsurp["0"] = append(byUsurp["0"], s)
		}
	}
	groups := []group{
		profile(fmt.Sprintf("lookalikes %.0f%%+", 100**min), like),
		profile("  with 3 Usurp", byUsurp["3"]),
		profile("  with 1-2 Usurp", byUsurp["1-2"]),
		profile("  with no Usurp", byUsurp["0"]),
	}
	for i, a := range r.Archetypes {
		groups = append(groups, group{fmt.Sprintf("archetype %d", i+1), a.Players, a.Turns, nil})
	}

	fmt.Printf("\n%-24s %6s %8s  %-28s %6s %6s %6s %6s %6s %9s\n", "group", "sides", "players", "won", "thr/t", "brick", "big", "peak", "usurp", "in losses")
	for _, g := range groups {
		printProfile(g.label, g.players, g.p)
	}
	fmt.Println("\nflips and returns: sides that flipped / came back by own turn 4; over the whole game, own turns that began as the Usurper per flip")
	fmt.Printf("%-24s %6s %8s %8s %12s %14s\n", "group", "sides", "flip t4", "back t4", "back/flip", "Usurper t/flip")
	for _, g := range groups {
		p := g.p
		if p.Sides == 0 || p.GameFlips == 0 {
			continue
		}
		fmt.Printf("%-24s %6d %7.0f%% %7.0f%% %11.0f%% %14.2f\n", g.label, p.Sides, 100*float64(p.FlipSides)/float64(p.Sides), 100*float64(p.BackSides)/float64(p.Sides),
			100*float64(p.GameBacks)/float64(p.GameFlips), float64(p.UsurperTurns)/float64(p.GameFlips))
	}

	fmt.Println("\neach player counted once: the mean of each player's win rate, with a 95% bootstrap interval over players")
	fmt.Printf("%-24s %6s %8s %-26s %-22s %10s %10s %9s\n", "group", "sides", "players", "won, by side", "won, by player", "top player", "their won", "rest won")
	all := profile("all kept Viserai", archetypes.Lookalikes(games, target, o, 0))
	for _, g := range append(groups[:4:4], all) {
		if len(g.sides) < minSample {
			continue
		}
		w := archetypes.ByPlayer(g.sides, 2000, 1)
		fmt.Printf("%-24s %6d %8d %-26s %5.1f%% [%4.1f-%4.1f]     %9.0f%% %9.0f%% %8.1f%%\n", g.label, len(g.sides), w.Players, rate(g.p.Wins, g.p.Sides),
			100*w.Rate, 100*w.Low, 100*w.High, 100*w.TopShare, 100*w.TopRate, 100*w.RestRate)
	}
	return nil
}

func printProfile(label string, players int, p archetypes.ProfileTally) {
	if p.Sides == 0 || p.Turns == 0 {
		fmt.Printf("%-24s %6d\n", label, p.Sides)
		return
	}
	pct := func(k, n int) float64 { return 100 * float64(k) / float64(n) }
	fmt.Printf("%-24s %6d %8d  %-28s %6.1f %5.0f%% %5.0f%% %5.0f%% %5.0f%% %8.0f%%\n", label, p.Sides, players, rate(p.Wins, p.Sides),
		float64(p.Threatened)/float64(p.Turns), pct(p.Bricks, p.Turns), pct(p.Big, p.Turns), pct(p.PeakSides, p.Sides), pct(p.UsurpSides, p.Sides), pct(p.UsurpSides-p.UsurpWins, p.Sides-p.Wins))
}

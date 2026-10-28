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

	fmt.Printf("\n%-24s %6s %8s  %-28s %6s %6s %6s %6s %6s %9s\n", "group", "sides", "players", "won", "thr/t", "brick", "big", "peak", "usurp", "in losses")
	like := archetypes.Lookalikes(games, target, o, *min)
	players := map[game.PlayerHash]bool{}
	for _, s := range like {
		players[s.Player] = true
	}
	printProfile(fmt.Sprintf("lookalikes %.0f%%+", 100**min), len(players), archetypes.Profile(like, po))
	for i, a := range r.Archetypes {
		label := fmt.Sprintf("archetype %d", i+1)
		printProfile(label, a.Players, a.Turns)
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

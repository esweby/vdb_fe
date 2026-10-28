package main

import (
	"flag"
	"fmt"
	"sort"

	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/turntypes"
)

// runTurns sorts each round of the kept Viserai sides into a turn type (UNVERIFIED
// types and thresholds) and prints them by round, as sequences and by card.
func runTurns(args []string) error {
	fs := flag.NewFlagSet("turns", flag.ContinueOnError)
	capN := fs.Int("cap", playerCap, "most sides one player contributes per day and format (0 for no cap)")
	minTurns := fs.Int("min-turns", 4, "fewest turn indexes a side needs to count")
	rounds := fs.Int("rounds", 4, "own turns tallied and in each sequence")
	burst := fs.Int("burst", 9, "damage threatened (arcane included) for a burst")
	defend := fs.Int("defend", 2, "hand cards blocked with to defend")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() == 0 {
		return fmt.Errorf("turns needs at least one CSV")
	}
	var games []game.Game
	for _, path := range fs.Args() {
		g, err := read(path)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		games = append(games, g...)
	}
	o := turntypes.Options{MinTurns: *minTurns, Concession: concession, PlayerCap: *capN, Rounds: *rounds, BurstAt: *burst, DefendBlocks: *defend}
	printTurns(turntypes.Compute(games, o), o)
	return nil
}

// byCount lists the keys with at least min sides, commonest first.
func byCount(m map[string]turntypes.Tally, min int) []string {
	var keys []string
	for k, t := range m {
		if t.Sides >= min {
			keys = append(keys, k)
		}
	}
	sort.Slice(keys, func(i, j int) bool {
		return m[keys[i]].Sides > m[keys[j]].Sides || (m[keys[i]].Sides == m[keys[j]].Sides && keys[i] < keys[j])
	})
	return keys
}

func printTurns(r turntypes.Result, o turntypes.Options) {
	c := r.Counts
	fmt.Printf("%d games, %d Viserai sides: %d kept (%d abandoned, %d without detail, %d under %d turns, %d capped)\n",
		c.Games, c.ViseraiSides, c.Kept, c.Abandoned, c.WithoutDetail, c.Short, o.MinTurns, c.Capped)
	fmt.Printf("UNVERIFIED turn types: burst = %d+ threatened; defend = %d+ hand cards blocked; build = a hand card played; quiet = none. +flip = traversed to the Usurper, +back = to the Forsaken. Each own turn includes the opponent's turn before it.\n", o.BurstAt, o.DefendBlocks)
	fmt.Println("(associations, not causes)")

	fmt.Printf("\nown turns 1-%d by hand cards played  share  threatened/turn  flip\n", o.Rounds)
	total := 0
	for _, w := range r.Width {
		total += w.Turns
	}
	for _, k := range turntypes.WidthBuckets {
		if w := r.Width[k]; w.Turns > 0 {
			fmt.Printf("  %-34s %5.1f%%  %15.1f  %3.0f%%\n", k, 100*float64(w.Turns)/float64(total),
				float64(w.Threatened)/float64(w.Turns), 100*float64(w.Flips)/float64(w.Turns))
		}
	}

	printBreakdown("all sides", &r.Breakdown, o)
	printBreakdown("went first", r.ByFirst["first"], o)
	printBreakdown("went second", r.ByFirst["second"], o)

	kinds := make([]string, 0, len(r.Cards))
	for k := range r.Cards {
		kinds = append(kinds, k)
	}
	sort.Strings(kinds)
	for _, k := range kinds {
		fmt.Printf("\n%s: cards\n", k)
		for _, a := range []string{"played", "pitched", "blocked"} {
			fmt.Printf("  %-8s %v\n", a, top(r.Cards[k][a], 6))
		}
	}
}

func printBreakdown(title string, b *turntypes.Breakdown, o turntypes.Options) {
	fmt.Printf("\n== %s: %d sides\n", title, b.Kept)
	for round, m := range b.ByRound {
		fmt.Printf("\nown turn %d             share   won\n", round+1)
		for _, k := range byCount(m, 1) {
			fmt.Printf("  %-18s %5.1f%%  %s\n", k, 100*float64(m[k].Sides)/float64(b.Kept), rate(m[k].Wins, m[k].Sides))
		}
	}
	fmt.Printf("\nwidest own turn 1-%d (hand cards played)   won\n", o.Rounds)
	for _, k := range turntypes.WidthBuckets {
		if t := b.Widest[k]; t.Sides > 0 {
			fmt.Printf("  %-34s %s\n", k, rate(t.Wins, t.Sides))
		}
	}
	fmt.Printf("\nsequences of own turns 1-%d with %d+ sides\n", o.Rounds, minSample)
	for i, k := range byCount(b.Sequences, minSample) {
		if i == 15 {
			break
		}
		fmt.Printf("  %-52s %s\n", k, rate(b.Sequences[k].Wins, b.Sequences[k].Sides))
	}
}

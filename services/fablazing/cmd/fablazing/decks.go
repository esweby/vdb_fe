package main

import (
	"flag"
	"fmt"
	"sort"

	"github.com/esweby/vdb_fe/services/fablazing/archetypes"
	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// runDecks groups the kept Viserai sides' lists into archetypes (UNVERIFIED
// clusters) and prints each one's results, cards and card lift.
func runDecks(args []string) error {
	fs := flag.NewFlagSet("decks", flag.ContinueOnError)
	capN := fs.Int("cap", playerCap, "most sides one player contributes per day and format (0 for no cap)")
	minTurns := fs.Int("min-turns", 4, "fewest turn indexes a side needs to count")
	k := fs.Int("k", 8, "archetypes to look for")
	minShare := fs.Float64("min-share", 0.02, "fewest lists, as a share, a card needs to count for clustering")
	format := fs.Int("format", -1, "only this format (0 CC, 1 Competitive CC); -1 for both")
	seed := fs.Uint64("seed", 1, "clustering seed")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() == 0 {
		return fmt.Errorf("decks needs at least one CSV")
	}
	var games []game.Game
	for _, path := range fs.Args() {
		g, err := read(path)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		for _, x := range g {
			if *format < 0 || x.Format == *format {
				games = append(games, x)
			}
		}
	}
	o := archetypes.Options{MinTurns: *minTurns, Concession: concession, PlayerCap: *capN, K: *k, MinShare: *minShare, MinSample: minSample, Seed: *seed}
	printDecks(archetypes.Compute(games, o), o)
	return nil
}

func printDecks(r archetypes.Result, o archetypes.Options) {
	c := r.Counts
	fmt.Printf("%d games, %d Viserai sides: %d kept (%d abandoned, %d without detail, %d under %d turns, %d capped)\n",
		c.Games, c.ViseraiSides, c.Kept, c.Abandoned, c.WithoutDetail, c.Short, o.MinTurns, c.Capped)
	fmt.Printf("UNVERIFIED archetypes: k-means on card inclusion, k=%d, cards in %.0f%%+ of lists; spread %.2f (lower is tighter)\n", o.K, 100*o.MinShare, r.Spread)
	fmt.Println("(associations, not causes; a list is the cards FaBlazing recorded for the side, which can include the sideboard)")

	for i, a := range r.Archetypes {
		fmt.Printf("\n== archetype %d: %d sides (%.1f%%) from %d players, %.0f cards a list, won %s\n", i+1, a.Sides, 100*float64(a.Sides)/float64(c.Kept), a.Players, a.MeanCards, rate(a.Wins, a.Sides))
		formats := make([]int, 0, len(a.ByFormat))
		for f := range a.ByFormat {
			formats = append(formats, f)
		}
		sort.Ints(formats)
		for _, f := range formats {
			fmt.Printf("  format %d           %s\n", f, rate(a.ByFormat[f].Wins, a.ByFormat[f].Sides))
		}
		for _, order := range []string{"first", "second"} {
			fmt.Printf("  went %-13s %s\n", order, rate(a.ByFirst[order].Wins, a.ByFirst[order].Sides))
		}
		fmt.Println("  runs more than lists overall (archetype / overall):")
		for _, card := range a.Distinctive(r.Inclusion, 10) {
			fmt.Printf("    %-40s %3.0f%% / %3.0f%%\n", card, 100*a.Inclusion[card], 100*r.Inclusion[card])
		}
		fmt.Printf("  core (in 80%%+ of its lists): %v\n", a.Core(0.8))
		if len(a.Lift) == 0 {
			continue
		}
		fmt.Printf("  card lift, %d+ sides with and without (with / without):\n", o.MinSample)
		show := a.Lift
		if len(show) > 16 {
			show = append(append([]archetypes.Lift(nil), show[:10]...), show[len(show)-6:]...)
		}
		for j, l := range show {
			if j == 10 && len(a.Lift) > 16 {
				fmt.Println("    ...")
			}
			fmt.Printf("    %-40s %s / %s\n", l.Card, rate(l.With.Wins, l.With.Sides), rate(l.Without.Wins, l.Without.Sides))
		}
	}
}

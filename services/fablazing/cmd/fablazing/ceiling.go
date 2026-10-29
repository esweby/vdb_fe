package main

import (
	"flag"
	"fmt"
	"sort"

	"github.com/esweby/vdb_fe/services/fablazing/archetypes"
	"github.com/esweby/vdb_fe/services/fablazing/ceiling"
	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/measure"
)

// runCeiling asks whether any Viserai pilot or matchup reaches 55–65%, with
// block slop and fatigue games reported apart (UNVERIFIED).
func runCeiling(args []string) error {
	fs := flag.NewFlagSet("ceiling", flag.ContinueOnError)
	capN := fs.Int("cap", playerCap, "most sides one player contributes per day and format (0 for no cap)")
	minTurns := fs.Int("min-turns", 4, "fewest turn indexes a side needs to count")
	k := fs.Int("k", 8, "archetypes to look for")
	minGames := fs.Int("min-games", 50, "fewest sides before a pilot is listed")
	top := fs.Int("top", 15, "pilots to print")
	seed := fs.Uint64("seed", 1, "clustering seed")
	likeTop := fs.Int("like-top", 5, "top pilots whose lists are measured in other hands")
	share := fs.Float64("share", 0.5, "share of a pilot's lists a card needs to be in their signature")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() == 0 {
		return fmt.Errorf("ceiling needs at least one CSV")
	}
	var games []game.Game
	for _, path := range fs.Args() {
		g, err := read(path)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		games = append(games, g...)
	}
	o := archetypes.Options{MinTurns: *minTurns, Concession: concession, PlayerCap: *capN, K: *k, MinShare: 0.02, MinSample: minSample, Seed: *seed}
	r := archetypes.Compute(games, o)
	slop := ceiling.BlockSlopArchetype(r, ceiling.BlockSlopMarkers)
	if slop < 0 {
		return fmt.Errorf("no archetypes")
	}
	g := ceiling.Split(archetypes.Kept(games, o), func(s game.Side) bool { return r.Nearest(archetypes.ListOf(s)) == slop })

	fmt.Printf("UNVERIFIED. %d kept Viserai sides. Block slop is archetype %d of %d, which runs %v\n", r.Counts.Kept, slop+1, len(r.Archetypes), r.Archetypes[slop].Distinctive(r.Inclusion, 6))
	fmt.Println("(associations, not causes; fatigue = the loser's deck was empty at the end)")
	for _, row := range []struct {
		name  string
		sides []game.Side
	}{{"Viserai without either", g.Main}, {"block slop", g.BlockSlop}, {"decided by fatigue", g.Fatigue}} {
		w := archetypes.ByPlayer(row.sides, 1000, *seed)
		fmt.Printf("  %-24s %s; by player %.1f%% [%.1f-%.1f] over %d players\n", row.name, rate(wins(row.sides), len(row.sides)), 100*w.Rate, 100*w.Low, 100*w.High, w.Players)
	}

	pilots := ceiling.Pilots(g.Main, *minGames)
	at := func(cut float64, f func(ceiling.Pilot) float64) int {
		n := 0
		for _, p := range pilots {
			if f(p) >= cut {
				n++
			}
		}
		return n
	}
	rateOf, lowOf := func(p ceiling.Pilot) float64 { return p.Rate }, func(p ceiling.Pilot) float64 { return p.Low }
	fmt.Printf("\n%d pilots with %d+ sides: %d won 55%%+, %d have an interval wholly above 50%%, %d wholly above 55%%\n",
		len(pilots), *minGames, at(0.55, rateOf), at(0.50, lowOf), at(0.55, lowOf))
	fmt.Println("  rank  won     95% interval   sides  their most played archetype")
	for i, p := range pilots {
		if i == *top {
			break
		}
		fmt.Printf("  %4d  %5.1f%%  [%4.1f-%4.1f]  %5d  %s\n", i+1, 100*p.Rate, 100*p.Low, 100*p.High, p.Games, mostPlayed(r, g.Main, p.Player))
	}

	fmt.Printf("\nDeck or pilot: each top pilot's signature (cards in %.0f%%+ of their lists), played by other players\n", 100**share)
	fmt.Println("  rank  pilot won  cards  similarity  sides  players  won by side               won by player          top player: share, won, a top pilot?")
	for i, p := range pilots {
		if i == *likeTop {
			break
		}
		sig := ceiling.Signature(g.Main, p.Player, *share)
		for _, min := range []float64{0.5, 0.6, 0.7} {
			like := ceiling.LookalikesByOthers(g.Main, p.Player, sig, min)
			if len(like) == 0 {
				fmt.Printf("  %4d  %8.1f%%  %5d  %9.0f%%+  %5d\n", i+1, 100*p.Rate, len(sig), 100*min, 0)
				continue
			}
			w := archetypes.ByPlayer(like, 1000, *seed)
			lo, hi := measure.Wilson(wins(like), len(like))
			fmt.Printf("  %4d  %8.1f%%  %5d  %9.0f%%+  %5d  %7d  %5.1f%% [%4.1f-%4.1f]       %5.1f%% [%4.1f-%4.1f]  %4.0f%% %4.0f%% %s\n", i+1, 100*p.Rate, len(sig), 100*min, len(like), w.Players,
				100*float64(wins(like))/float64(len(like)), 100*lo, 100*hi, 100*w.Rate, 100*w.Low, 100*w.High, 100*w.TopShare, 100*w.TopRate, pilotRank(pilots, topPlayer(like)))
		}
	}

	fmt.Printf("\nMatchups, Viserai without either, %d+ sides:\n", minSample)
	by := map[string][]game.Side{}
	for _, s := range g.Main {
		by[s.Opponent] = append(by[s.Opponent], s)
	}
	opps := make([]string, 0, len(by))
	for o, s := range by {
		if len(s) >= minSample {
			opps = append(opps, o)
		}
	}
	sort.Slice(opps, func(i, j int) bool {
		a, b := by[opps[i]], by[opps[j]]
		return float64(wins(a))/float64(len(a)) > float64(wins(b))/float64(len(b))
	})
	for _, o := range opps {
		fmt.Printf("  %-36s %s\n", o, rate(wins(by[o]), len(by[o])))
	}
	return nil
}

func wins(sides []game.Side) int {
	n := 0
	for _, s := range sides {
		if s.Won {
			n++
		}
	}
	return n
}

// mostPlayed is the archetype the player's sides are nearest most often, and its share.
func mostPlayed(r archetypes.Result, sides []game.Side, player game.PlayerHash) string {
	count := map[int]int{}
	n := 0
	for _, s := range sides {
		if s.Player == player {
			count[r.Nearest(archetypes.ListOf(s))]++
			n++
		}
	}
	best := -1
	for a, c := range count {
		if best < 0 || c > count[best] || (c == count[best] && a < best) {
			best = a
		}
	}
	return fmt.Sprintf("%d (%.0f%% of their sides)", best+1, 100*float64(count[best])/float64(n))
}

// topPlayer is the player with the most sides.
func topPlayer(sides []game.Side) game.PlayerHash {
	count := map[game.PlayerHash]int{}
	var best game.PlayerHash
	for _, s := range sides {
		count[s.Player]++
		if count[s.Player] > count[best] || (count[s.Player] == count[best] && s.Player < best) {
			best = s.Player
		}
	}
	return best
}

// pilotRank names a player by their rank among the pilots, never by hash.
func pilotRank(pilots []ceiling.Pilot, player game.PlayerHash) string {
	for i, p := range pilots {
		if p.Player == player {
			return fmt.Sprintf("pilot %d", i+1)
		}
	}
	return "-"
}

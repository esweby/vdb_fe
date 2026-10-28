package archetypes

import (
	"math/rand/v2"
	"sort"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// PlayerWeighted is a group's win rate with each player counted once: the
// mean of each player's own win rate, with a 95% bootstrap interval over
// players. TopShare is the busiest player's share of the sides, TopRate
// their win rate, and RestRate the win rate by side without them.
type PlayerWeighted struct {
	Players                     int
	Rate, Low, High             float64
	TopShare, TopRate, RestRate float64
}

// ByPlayer weighs each player equally, resampling players resamples times
// with the given seed for the interval.
func ByPlayer(sides []game.Side, resamples int, seed uint64) PlayerWeighted {
	type tally struct{ sides, wins int }
	per := map[game.PlayerHash]tally{}
	for _, s := range sides {
		t := per[s.Player]
		t.sides++
		if s.Won {
			t.wins++
		}
		per[s.Player] = t
	}
	if len(per) == 0 {
		return PlayerWeighted{}
	}
	players := make([]game.PlayerHash, 0, len(per))
	for p := range per {
		players = append(players, p)
	}
	sort.Slice(players, func(i, j int) bool { return players[i] < players[j] })
	rates := make([]float64, len(players))
	var top tally
	wins := 0
	for i, p := range players {
		rates[i] = float64(per[p].wins) / float64(per[p].sides)
		wins += per[p].wins
		if per[p].sides > top.sides {
			top = per[p]
		}
	}
	mean := func(pick func(int) int) float64 {
		sum := 0.0
		for i := range rates {
			sum += rates[pick(i)]
		}
		return sum / float64(len(rates))
	}
	w := PlayerWeighted{Players: len(players), Rate: mean(func(i int) int { return i }), TopShare: float64(top.sides) / float64(len(sides)), TopRate: float64(top.wins) / float64(top.sides)}
	if rest := len(sides) - top.sides; rest > 0 {
		w.RestRate = float64(wins-top.wins) / float64(rest)
	}
	rng := rand.New(rand.NewPCG(seed, seed))
	boot := make([]float64, resamples)
	for b := range boot {
		boot[b] = mean(func(int) int { return rng.IntN(len(rates)) })
	}
	sort.Float64s(boot)
	if resamples > 0 {
		w.Low, w.High = boot[int(0.025*float64(resamples))], boot[min(resamples-1, int(0.975*float64(resamples)))]
	}
	return w
}

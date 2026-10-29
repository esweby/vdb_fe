// Package ceiling asks whether a Viserai list wins 55–65% on Talishar, or
// whether the hero tops out below that (UNVERIFIED; see docs/viserai-ceiling.md).
// Block slop lists, which win by fatiguing the game rather than through
// Viserai's mechanics, and games decided by fatigue are reported apart from
// the answer (the maintainer, 29 Oct 2026).
package ceiling

import (
	"sort"

	"github.com/esweby/vdb_fe/services/fablazing/archetypes"
	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/measure"
)

// BlockSlopMarkers are the defence cards the block slop archetype runs more
// than other lists (docs/deck-archetypes.md, archetype 6).
var BlockSlopMarkers = []string{"sink_below_red", "shelter_from_the_storm_red", "ripple_away_blue", "fate_foreseen_red"}

// Groups is the kept sides split three ways. A block slop side decided by
// fatigue counts as block slop.
type Groups struct {
	Main, BlockSlop, Fatigue []game.Side
}

// Split puts each side in one group.
func Split(sides []game.Side, isBlockSlop func(game.Side) bool) Groups {
	var g Groups
	for _, s := range sides {
		switch {
		case isBlockSlop(s):
			g.BlockSlop = append(g.BlockSlop, s)
		case s.Fatigue:
			g.Fatigue = append(g.Fatigue, s)
		default:
			g.Main = append(g.Main, s)
		}
	}
	return g
}

// BlockSlopArchetype is the archetype with the highest mean inclusion of the
// markers, or -1 when there are no archetypes.
func BlockSlopArchetype(r archetypes.Result, markers []string) int {
	best, bestScore := -1, -1.0
	for i, a := range r.Archetypes {
		score := 0.0
		for _, m := range markers {
			score += a.Inclusion[m]
		}
		if score > bestScore {
			best, bestScore = i, score
		}
	}
	return best
}

// Pilot is one player's Viserai record, with a 95% Wilson interval.
type Pilot struct {
	Player          game.PlayerHash
	Games, Wins     int
	Rate, Low, High float64
}

// Pilots is every player with at least minGames sides, highest lower edge
// first, so a short lucky run doesn't outrank a long good one.
func Pilots(sides []game.Side, minGames int) []Pilot {
	per := map[game.PlayerHash]*Pilot{}
	for _, s := range sides {
		p := per[s.Player]
		if p == nil {
			p = &Pilot{Player: s.Player}
			per[s.Player] = p
		}
		p.Games++
		if s.Won {
			p.Wins++
		}
	}
	var out []Pilot
	for _, p := range per {
		if p.Games < minGames {
			continue
		}
		p.Rate = float64(p.Wins) / float64(p.Games)
		p.Low, p.High = measure.Wilson(p.Wins, p.Games)
		out = append(out, *p)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Low != out[j].Low {
			return out[i].Low > out[j].Low
		}
		return out[i].Games > out[j].Games
	})
	return out
}

// Signature is the cards in at least share of a player's lists: the list they
// settled on, for finding the same list in other hands.
func Signature(sides []game.Side, player game.PlayerHash, share float64) map[string]bool {
	count, n := map[string]int{}, 0
	for _, s := range sides {
		if s.Player != player {
			continue
		}
		n++
		for c := range archetypes.ListOf(s) {
			count[c]++
		}
	}
	out := map[string]bool{}
	for c, k := range count {
		if float64(k) >= share*float64(n) {
			out[c] = true
		}
	}
	return out
}

// LookalikesByOthers is the sides by anyone but player whose list is at least
// min similar to target, so a list's record isn't the pilot's own.
func LookalikesByOthers(sides []game.Side, player game.PlayerHash, target map[string]bool, min float64) []game.Side {
	var out []game.Side
	for _, s := range sides {
		if s.Player != player && archetypes.Similarity(archetypes.ListOf(s), target) >= min {
			out = append(out, s)
		}
	}
	return out
}

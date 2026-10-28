package archetypes

import (
	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/turntypes"
)

// ProfileOptions sets what a turn profile counts. The thresholds are
// UNVERIFIED: Brick is a turn threatening under it, Big a turn threatening
// at least it, Peak a side's best turn reaching it.
type ProfileOptions struct {
	Rounds           int // own turns from the first
	Brick, Big, Peak int
	Usurp            string // card id counted when played at any point in the game
}

// ProfileTally is how a group of sides played its own turns 1 to Rounds:
// damage threatened (arcane included), bricks, big turns and flips to the
// Usurper by turn; sides whose best turn reached Peak, and sides that played
// Usurp at any point in the game (and won). FaBlazing doesn't log a game's
// last attack, so a Usurp that won the game can be missed: losses are the
// cleaner count.
type ProfileTally struct {
	Sides, Wins                      int
	Turns, Threatened, Bricks, Big   int
	Flips                            int
	PeakSides, UsurpSides, UsurpWins int
}

// Profile tallies the own turns of sides. Only turns recorded in the game's
// turn results count.
func Profile(sides []game.Side, o ProfileOptions) ProfileTally {
	var p ProfileTally
	for _, s := range sides {
		p.Sides++
		if s.Won {
			p.Wins++
		}
		best, usurp := 0, false
		for turn := range o.Rounds {
			round := turntypes.Round(s, turn)
			if round >= len(s.TurnStats) || !s.TurnStats[round].Recorded {
				continue
			}
			events, threatened := turntypes.OwnTurn(s, turn)
			p.Turns++
			p.Threatened += threatened
			if threatened < o.Brick {
				p.Bricks++
			}
			if threatened >= o.Big {
				p.Big++
			}
			best = max(best, threatened)
			flip := false
			for _, e := range events {
				flip = flip || (e.Action == "TRANSFORM" && e.Card == "viserai_usurper")
			}
			if flip {
				p.Flips++
			}
		}
		if best >= o.Peak {
			p.PeakSides++
		}
		for _, e := range s.Log {
			usurp = usurp || (e.Card == o.Usurp && (e.Action == "M" || e.Action == "INSTANT"))
		}
		if usurp {
			p.UsurpSides++
			if s.Won {
				p.UsurpWins++
			}
		}
	}
	return p
}

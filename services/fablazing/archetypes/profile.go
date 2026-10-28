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

// ProfileTally is how a group of sides played. Over own turns 1 to Rounds:
// damage threatened (arcane included), bricks, big turns, turns with a flip
// to the Usurper and with a return to the Forsaken, and the sides that
// flipped or returned at all. Sides whose best turn reached Peak, and sides
// that played Usurp at any point in the game (and won): FaBlazing doesn't log
// a game's last attack, so a Usurp that won the game can be missed, and
// losses are the cleaner count. Over the whole game: own turns, flips,
// returns, and own turns that began as the Usurper.
type ProfileTally struct {
	Sides, Wins                      int
	Turns, Threatened, Bricks, Big   int
	Flips, Backs                     int
	FlipSides, BackSides             int
	PeakSides, UsurpSides, UsurpWins int
	GameTurns, GameFlips, GameBacks  int
	UsurperTurns                     int
}

// Copies is how many copies of a card a side's list runs.
func Copies(s game.Side, card string) int {
	n := 0
	for _, c := range s.Cards {
		if c.ID == card {
			n += c.Copies
		}
	}
	return n
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
		best, flipped, back, usurper := 0, false, false, false
		for turn := 0; ; turn++ {
			round := turntypes.Round(s, turn)
			if round >= len(s.TurnStats) {
				break
			}
			if !s.TurnStats[round].Recorded {
				continue
			}
			events, threatened := turntypes.OwnTurn(s, turn)
			p.GameTurns++
			if usurper {
				p.UsurperTurns++
			}
			flips, backs := 0, 0
			for _, e := range events {
				if e.Action != "TRANSFORM" {
					continue
				}
				switch e.Card {
				case "viserai_usurper":
					flips++
					usurper = true
				case "viserai_the_forsaken":
					backs++
					usurper = false
				}
			}
			p.GameFlips += flips
			p.GameBacks += backs
			if turn >= o.Rounds {
				continue
			}
			p.Turns++
			p.Threatened += threatened
			if threatened < o.Brick {
				p.Bricks++
			}
			if threatened >= o.Big {
				p.Big++
			}
			best = max(best, threatened)
			if flips > 0 {
				p.Flips++
				flipped = true
			}
			if backs > 0 {
				p.Backs++
				back = true
			}
		}
		if best >= o.Peak {
			p.PeakSides++
		}
		if flipped {
			p.FlipSides++
		}
		if back {
			p.BackSides++
		}
		usurp := false
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

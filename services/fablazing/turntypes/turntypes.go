// Package turntypes sorts each round of a real Viserai game into a turn type from
// its logged events, and tallies the types by round, as sequences, and by the
// cards used. The types and thresholds are UNVERIFIED: a spike to find turn
// objectives from data (docs/fablazing-data-dictionary.md has the codes).
//
// A round is a turn index: the side's own turn and the opponent's, so its
// blocks and its plays are counted together.
package turntypes

import (
	"sort"
	"strings"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// Options for one computation.
type Options struct {
	MinTurns     int
	Concession   game.ConcessionRule
	PlayerCap    int // per day and format; 0 for no cap
	Rounds       int // own turns tallied and in each sequence, from the first
	BurstAt      int // damage threatened (arcane included) for a burst
	DefendBlocks int // cards from hand blocked with (defence reactions too) to defend
}

// Counts says which Viserai sides were kept, and why the rest weren't.
type Counts struct{ Games, ViseraiSides, Abandoned, WithoutDetail, Short, Capped, Kept int }

// Tally is how many kept sides had something, and how many of them won.
type Tally struct{ Sides, Wins int }

// WidthTally is the own turns that played a number of hand cards: how many,
// their damage threatened in total, and how many traversed to the Usurper.
type WidthTally struct{ Turns, Threatened, Flips int }

// WidthBucket groups a number of hand cards played in a turn.
func WidthBucket(n int) string {
	switch {
	case n <= 2:
		return "0-2"
	case n == 3:
		return "3"
	case n <= 5:
		return "4-5"
	case n <= 7:
		return "6-7"
	}
	return "8+"
}

// WidthBuckets are WidthBucket's groups, narrowest first.
var WidthBuckets = []string{"0-2", "3", "4-5", "6-7", "8+"}

// Breakdown is the round and sequence tallies for one group of kept sides.
// Widest is by the most hand cards played in any own turn tallied.
type Breakdown struct {
	Kept      int
	ByRound   []map[string]Tally
	Sequences map[string]Tally
	Widest    map[string]Tally
}

func newBreakdown(rounds int) *Breakdown {
	b := &Breakdown{ByRound: make([]map[string]Tally, rounds), Sequences: map[string]Tally{}, Widest: map[string]Tally{}}
	for i := range b.ByRound {
		b.ByRound[i] = map[string]Tally{}
	}
	return b
}

func (b *Breakdown) add(kinds []string, widest string, win int) {
	b.Kept++
	w := b.Widest[widest]
	b.Widest[widest] = Tally{w.Sides + 1, w.Wins + win}
	for round, kind := range kinds {
		t := b.ByRound[round][kind]
		b.ByRound[round][kind] = Tally{t.Sides + 1, t.Wins + win}
	}
	seq := strings.Join(kinds, " > ")
	t := b.Sequences[seq]
	b.Sequences[seq] = Tally{t.Sides + 1, t.Wins + win}
}

// Result is the tallies, pooled and split by who went first ("first" or
// "second"). Cards is by turn type, then action (played, pitched, blocked),
// then card id, over the rounds tallied. Width is every own turn tallied, by
// hand cards played.
type Result struct {
	Counts Counts
	Breakdown
	ByFirst map[string]*Breakdown
	Cards   map[string]map[string]map[string]int
	Width   map[string]WidthTally
}

// tokens are logged like cards but aren't from the hand.
var tokens = map[string]bool{"gate_to_iarathael": true, "runechant": true}

// handCard reports whether a logged card came from the hand or deck, not the
// hero, weapons, equipment or a token.
func handCard(s game.Side, card string) bool {
	if tokens[card] {
		return false
	}
	for _, c := range s.Character {
		if c == card {
			return false
		}
	}
	return true
}

// action is what a log code did with a hand card, or "" for anything else.
func action(code string) string {
	switch code {
	case "M", "INSTANT":
		return "played"
	case "P":
		return "pitched"
	case "B", "D":
		return "blocked"
	}
	return ""
}

// Round is the round (turn index) an own turn (0 for the first) takes its
// damage threatened from: the same going first, one later going second.
func Round(s game.Side, turn int) int {
	if s.WentFirst() {
		return turn
	}
	return turn + 1
}

// OwnTurn is the side's own turn (0 for its first) with the opponent's turn
// before it, and the damage it threatened. Going first, that's one round: round
// 0 is only the first turn, and later rounds are the opponent's turn, then
// yours. Going second, round 0 is only the opponent's first turn and later
// rounds are yours, then the opponent's, split at the first block. Inferred
// from the logs, not documented by FaBlazing.
func OwnTurn(s game.Side, turn int) (events []game.Event, threatened int) {
	round := Round(s, turn)
	if round < len(s.TurnStats) {
		threatened = s.TurnStats[round].DamageThreatened
	}
	if s.WentFirst() {
		for _, e := range s.Log {
			if e.Turn == round {
				events = append(events, e)
			}
		}
		return events, threatened
	}
	opp, _ := splitRound(s, round-1)
	_, own := splitRound(s, round)
	return append(opp, own...), threatened
}

// splitRound splits a going-second side's round into the opponent's turn that
// ends it and the side's own turn that starts it (round 0 has no own turn).
func splitRound(s game.Side, round int) (opp, own []game.Event) {
	blocking := round == 0
	for _, e := range s.Log {
		if e.Turn != round {
			continue
		}
		if e.Action == "B" || e.Action == "D" {
			blocking = true
		}
		if blocking {
			opp = append(opp, e)
		} else {
			own = append(own, e)
		}
	}
	return opp, own
}

// Classify gives an own turn's type (0 for the first): burst (damage threatened
// at BurstAt or more), defend (DefendBlocks or more hand cards blocked with in
// the opponent's turn before), build (a hand card played) or quiet, with
// "+flip" when Viserai traversed to the Usurper and "+back" when it traversed
// to the Forsaken.
func Classify(s game.Side, turn int, o Options) string {
	events, threatened := OwnTurn(s, turn)
	var plays, blocks int
	flip, back := false, false
	for _, e := range events {
		if e.Action == "TRANSFORM" {
			flip = flip || e.Card == "viserai_usurper"
			back = back || e.Card == "viserai_the_forsaken"
		}
		if !handCard(s, e.Card) {
			continue
		}
		switch action(e.Action) {
		case "played":
			plays++
		case "blocked":
			blocks++
		}
	}
	kind := "quiet"
	switch {
	case threatened >= o.BurstAt:
		kind = "burst"
	case blocks >= o.DefendBlocks:
		kind = "defend"
	case plays > 0:
		kind = "build"
	}
	if flip {
		kind += "+flip"
	}
	if back {
		kind += "+back"
	}
	return kind
}

type capKey struct {
	player game.PlayerHash
	day    string
	format int
}

// Compute tallies the kept Viserai sides of a batch of games: detailed, at least
// MinTurns rounds (one more than Rounds going second), not abandoned, and within each player's earliest PlayerCap
// sides per day and format.
func Compute(games []game.Game, o Options) Result {
	r := Result{
		Breakdown: *newBreakdown(o.Rounds),
		ByFirst:   map[string]*Breakdown{"first": newBreakdown(o.Rounds), "second": newBreakdown(o.Rounds)},
		Cards:     map[string]map[string]map[string]int{},
		Width:     map[string]WidthTally{},
	}
	ordered := append([]game.Game(nil), games...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i].CreatedAt != ordered[j].CreatedAt {
			return ordered[i].CreatedAt < ordered[j].CreatedAt
		}
		return ordered[i].GUID < ordered[j].GUID
	})
	perPlayer := map[capKey]int{}
	c := &r.Counts
	for _, g := range ordered {
		c.Games++
		abandoned := g.Abandoned(o.Concession)
		for _, s := range g.Sides {
			capped := false
			if s.Player != "" && o.PlayerCap > 0 {
				k := capKey{s.Player, day(g.CreatedAt), g.Format}
				perPlayer[k]++
				capped = perPlayer[k] > o.PlayerCap
			}
			if !game.IsViserai(s.Hero) {
				continue
			}
			c.ViseraiSides++
			switch {
			case abandoned:
				c.Abandoned++
			case !s.Detailed:
				c.WithoutDetail++
			case s.Turns < o.MinTurns, !s.WentFirst() && s.Turns <= o.Rounds:
				c.Short++
			case capped:
				c.Capped++
			default:
				c.Kept++
				r.add(s, o)
			}
		}
	}
	return r
}

func (r *Result) add(s game.Side, o Options) {
	win := 0
	if s.Won {
		win = 1
	}
	kinds := make([]string, o.Rounds)
	widest := 0
	for round := range kinds {
		kind := Classify(s, round, o)
		kinds[round] = kind
		events, threatened := OwnTurn(s, round)
		played, flip := 0, 0
		for _, e := range events {
			if e.Action == "TRANSFORM" && e.Card == "viserai_usurper" {
				flip = 1
			}
			a := action(e.Action)
			if a == "" || !handCard(s, e.Card) {
				continue
			}
			if a == "played" {
				played++
			}
			if r.Cards[kind] == nil {
				r.Cards[kind] = map[string]map[string]int{}
			}
			if r.Cards[kind][a] == nil {
				r.Cards[kind][a] = map[string]int{}
			}
			r.Cards[kind][a][e.Card]++
		}
		w := r.Width[WidthBucket(played)]
		r.Width[WidthBucket(played)] = WidthTally{w.Turns + 1, w.Threatened + threatened, w.Flips + flip}
		widest = max(widest, played)
	}
	r.Breakdown.add(kinds, WidthBucket(widest), win)
	order := "second"
	if s.WentFirst() {
		order = "first"
	}
	r.ByFirst[order].add(kinds, WidthBucket(widest), win)
}

func day(createdAt string) string {
	if len(createdAt) >= 10 {
		return createdAt[:10]
	}
	return createdAt
}

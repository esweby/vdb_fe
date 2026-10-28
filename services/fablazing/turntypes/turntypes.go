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
	Rounds       int // rounds tallied and in each sequence, from 0
	BurstAt      int // damage threatened (arcane included) for a burst
	DefendBlocks int // cards from hand blocked with (defence reactions too) to defend
}

// Counts says which Viserai sides were kept, and why the rest weren't.
type Counts struct{ Games, ViseraiSides, Abandoned, WithoutDetail, Short, Capped, Kept int }

// Tally is how many kept sides had something, and how many of them won.
type Tally struct{ Sides, Wins int }

// Breakdown is the round and sequence tallies for one group of kept sides.
type Breakdown struct {
	Kept      int
	ByRound   []map[string]Tally
	Sequences map[string]Tally
}

func newBreakdown(rounds int) *Breakdown {
	b := &Breakdown{ByRound: make([]map[string]Tally, rounds), Sequences: map[string]Tally{}}
	for i := range b.ByRound {
		b.ByRound[i] = map[string]Tally{}
	}
	return b
}

func (b *Breakdown) add(kinds []string, win int) {
	b.Kept++
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
// then card id, over the rounds tallied.
type Result struct {
	Counts Counts
	Breakdown
	ByFirst map[string]*Breakdown
	Cards   map[string]map[string]map[string]int
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

// Classify gives one round's turn type: burst (damage threatened at BurstAt or
// more), defend (DefendBlocks or more hand cards blocked with), build (a hand
// card played) or quiet, with "+flip" when Viserai traversed to the Usurper.
func Classify(s game.Side, round int, o Options) string {
	var plays, blocks int
	flip := false
	for _, e := range s.Log {
		if e.Turn != round {
			continue
		}
		if e.Action == "TRANSFORM" && e.Card == "viserai_usurper" {
			flip = true
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
	threatened := 0
	if round < len(s.TurnStats) {
		threatened = s.TurnStats[round].DamageThreatened
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
	return kind
}

type capKey struct {
	player game.PlayerHash
	day    string
	format int
}

// Compute tallies the kept Viserai sides of a batch of games: detailed, at least
// MinTurns rounds, not abandoned, and within each player's earliest PlayerCap
// sides per day and format.
func Compute(games []game.Game, o Options) Result {
	r := Result{
		Breakdown: *newBreakdown(o.Rounds),
		ByFirst:   map[string]*Breakdown{"first": newBreakdown(o.Rounds), "second": newBreakdown(o.Rounds)},
		Cards:     map[string]map[string]map[string]int{},
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
			case s.Turns < o.MinTurns:
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
	for round := range kinds {
		kind := Classify(s, round, o)
		kinds[round] = kind
		for _, e := range s.Log {
			a := action(e.Action)
			if e.Turn != round || a == "" || !handCard(s, e.Card) {
				continue
			}
			if r.Cards[kind] == nil {
				r.Cards[kind] = map[string]map[string]int{}
			}
			if r.Cards[kind][a] == nil {
				r.Cards[kind][a] = map[string]int{}
			}
			r.Cards[kind][a][e.Card]++
		}
	}
	r.Breakdown.add(kinds, win)
	order := "second"
	if s.WentFirst() {
		order = "first"
	}
	r.ByFirst[order].add(kinds, win)
}

func day(createdAt string) string {
	if len(createdAt) >= 10 {
		return createdAt[:10]
	}
	return createdAt
}

// Package chain matches pre-registered card chains against a game's action
// log. A chain is data (a Spec), not code, so the same definitions can later
// drive the chain library's schema. Every chain's game logic is unverified
// until the maintainer checks it, and its expectation is written before it is
// measured.
package chain

import (
	"encoding/json"
	"fmt"
	"io"
	"slices"
	"strings"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// Sets names groups of card ids, such as "blood_debt", built from our card facts.
type Sets map[string]map[string]bool

// Spec is one chain: ordered steps, each matched against a log event.
type Spec struct {
	ID          string `json:"id"`
	Status      string `json:"status"`
	Expectation string `json:"expectation"`
	Steps       []Step `json:"steps"`
	// CompareFrom names the step that splits the comparison: sides reaching
	// it against sides that set up but don't. Empty means the last step.
	CompareFrom string `json:"compareFrom,omitempty"`
	paidAt      int    // steps that must be reached to count as paid
	sets        Sets
}

// Step matches one event. WithinTurns limits how many turns after the
// previous step it may come (0 = the same turn); nil means no limit.
type Step struct {
	Name        string   `json:"name"`
	Action      string   `json:"action,omitempty"`
	Actions     []string `json:"actions,omitempty"` // any of these, instead of Action
	Card        string   `json:"card,omitempty"`
	Set         string   `json:"set,omitempty"`
	AnyCard     bool     `json:"anyCard,omitempty"` // any card, instead of Card or Set
	WithinTurns *int     `json:"withinTurns,omitempty"`
	// Unless rules the step out if any of these events comes after the
	// previous step and before this one (for example another Gate maker).
	Unless []Pattern `json:"unless,omitempty"`
	// AnyOrder lets a same-turn step (WithinTurns 0) match an event before
	// the previous step in that turn, when the log's order isn't meaningful
	// (for example two cards blocking together). Later steps follow both.
	AnyOrder bool `json:"anyOrder,omitempty"`
}

// Pattern matches an event by action and card or card set, like a step.
type Pattern struct {
	Action  string   `json:"action,omitempty"`
	Actions []string `json:"actions,omitempty"`
	Card    string   `json:"card,omitempty"`
	Set     string   `json:"set,omitempty"`
	AnyCard bool     `json:"anyCard,omitempty"`
}

func (st Step) pattern() Pattern {
	return Pattern{Action: st.Action, Actions: st.Actions, Card: st.Card, Set: st.Set, AnyCard: st.AnyCard}
}

// Result is the furthest a game got through a chain.
type Result struct {
	Reached    int    // steps matched, 0 to len(Steps)
	StepTurns  []int  // the turn of each matched step
	SetupTurn  int    // turn of the first step, or -1
	PayoffTurn int    // turn of the last step if the chain completed, or -1
	PayoffCard string // the card that matched the last step, if completed
}

// Registered reports whether the chain's expectation has been written down,
// which must happen before it is measured.
func (s Spec) Registered() bool {
	e := strings.TrimSpace(s.Expectation)
	return e != "" && !strings.HasPrefix(strings.ToUpper(e), "TODO")
}

// Complete reports whether every step matched.
func (r Result) Complete(s Spec) bool { return r.Reached == len(s.Steps) }

// Paid reports whether a side counts in the paid group of the comparison:
// it reached the CompareFrom step, or completed the chain by default.
func (s Spec) Paid(r Result) bool { return r.Reached >= s.paidAt }

// ParseSpec reads a chain and checks it against the known card sets.
func ParseSpec(r io.Reader, sets Sets) (Spec, error) {
	var s Spec
	if err := json.NewDecoder(r).Decode(&s); err != nil {
		return Spec{}, fmt.Errorf("chain spec: %w", err)
	}
	if len(s.Steps) == 0 {
		return Spec{}, fmt.Errorf("chain %q has no steps", s.ID)
	}
	for _, st := range s.Steps {
		if st.AnyOrder && (st.WithinTurns == nil || *st.WithinTurns != 0) {
			return Spec{}, fmt.Errorf("chain %q step %q: anyOrder needs withinTurns 0", s.ID, st.Name)
		}
		for _, p := range append([]Pattern{st.pattern()}, st.Unless...) {
			if n := countTrue(p.Card != "", p.Set != "", p.AnyCard); n != 1 {
				return Spec{}, fmt.Errorf("chain %q step %q needs exactly one of card, set or anyCard", s.ID, st.Name)
			}
			if p.Action != "" && len(p.Actions) > 0 {
				return Spec{}, fmt.Errorf("chain %q step %q has both action and actions", s.ID, st.Name)
			}
			if p.Set != "" && sets[p.Set] == nil {
				return Spec{}, fmt.Errorf("chain %q step %q uses unknown set %q", s.ID, st.Name, p.Set)
			}
		}
	}
	s.paidAt = len(s.Steps)
	if s.CompareFrom != "" {
		i := slices.IndexFunc(s.Steps, func(st Step) bool { return st.Name == s.CompareFrom })
		if i < 1 {
			return Spec{}, fmt.Errorf("chain %q: compareFrom %q must name a step after the setup", s.ID, s.CompareFrom)
		}
		s.paidAt = i + 1
	}
	s.sets = sets
	return s, nil
}

func countTrue(bs ...bool) int {
	n := 0
	for _, b := range bs {
		if b {
			n++
		}
	}
	return n
}

func (s Spec) matches(st Pattern, e game.Event) bool {
	if st.Action != "" && st.Action != e.Action {
		return false
	}
	if len(st.Actions) > 0 && !slices.Contains(st.Actions, e.Action) {
		return false
	}
	if st.AnyCard {
		return true
	}
	if st.Card != "" {
		return st.Card == e.Card
	}
	return s.sets[st.Set][e.Card]
}

// Match finds the best attempt at the chain in a log: the one that gets
// furthest, and the earliest of those.
func (s Spec) Match(log []game.Event) Result {
	best := Result{SetupTurn: -1, PayoffTurn: -1}
	for start, e := range log {
		if !s.matches(s.Steps[0].pattern(), e) {
			continue
		}
		r := s.attempt(log, start)
		if r.Reached > best.Reached {
			best = r
		}
	}
	return best
}

// attempt follows the chain from one setup event, taking the earliest event
// that fits each later step.
func (s Spec) attempt(log []game.Event, start int) Result {
	r := Result{Reached: 1, StepTurns: []int{log[start].Turn}, SetupTurn: log[start].Turn, PayoffTurn: -1}
	at, last := start, start // the previous step's event, and the latest event matched so far
	for _, st := range s.Steps[1:] {
		prevTurn := log[at].Turn
		next := -1
		if st.AnyOrder {
			for i := at - 1; i >= 0 && log[i].Turn == prevTurn; i-- {
				if s.matches(st.pattern(), log[i]) {
					next = i
					break
				}
			}
		}
		if next < 0 {
			next = s.find(st, log, last, prevTurn)
		}
		if next < 0 {
			return r
		}
		at = next
		last = max(last, next)
		r.Reached++
		r.StepTurns = append(r.StepTurns, log[at].Turn)
	}
	r.PayoffTurn, r.PayoffCard = log[at].Turn, log[at].Card
	return r
}

// find returns the first event after index from that fits the step within its
// window, or -1 if none does or an Unless event comes first.
func (s Spec) find(st Step, log []game.Event, from, prevTurn int) int {
	next := -1
	for i := from + 1; i < len(log); i++ {
		if st.WithinTurns != nil && log[i].Turn-prevTurn > *st.WithinTurns {
			break
		}
		if s.matches(st.pattern(), log[i]) {
			next = i
			break
		}
		if slices.ContainsFunc(st.Unless, func(p Pattern) bool { return s.matches(p, log[i]) }) {
			break
		}
	}
	return next
}

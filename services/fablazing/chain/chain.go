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
	WithinTurns *int     `json:"withinTurns,omitempty"`
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
		if (st.Card == "") == (st.Set == "") {
			return Spec{}, fmt.Errorf("chain %q step %q needs exactly one of card or set", s.ID, st.Name)
		}
		if st.Action != "" && len(st.Actions) > 0 {
			return Spec{}, fmt.Errorf("chain %q step %q has both action and actions", s.ID, st.Name)
		}
		if st.Set != "" && sets[st.Set] == nil {
			return Spec{}, fmt.Errorf("chain %q step %q uses unknown set %q", s.ID, st.Name, st.Set)
		}
	}
	s.sets = sets
	return s, nil
}

func (s Spec) matches(st Step, e game.Event) bool {
	if st.Action != "" && st.Action != e.Action {
		return false
	}
	if len(st.Actions) > 0 && !slices.Contains(st.Actions, e.Action) {
		return false
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
		if !s.matches(s.Steps[0], e) {
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
	at := start
	for _, st := range s.Steps[1:] {
		prevTurn := log[at].Turn
		next := -1
		for i := at + 1; i < len(log); i++ {
			if st.WithinTurns != nil && log[i].Turn-prevTurn > *st.WithinTurns {
				break
			}
			if s.matches(st, log[i]) {
				next = i
				break
			}
		}
		if next < 0 {
			return r
		}
		at = next
		r.Reached++
		r.StepTurns = append(r.StepTurns, log[at].Turn)
	}
	r.PayoffTurn, r.PayoffCard = log[at].Turn, log[at].Card
	return r
}

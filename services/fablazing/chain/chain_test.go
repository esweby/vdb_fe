package chain

import (
	"strings"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

const specJSON = `{
  "id": "bsl-gate-blood-debt",
  "status": "unverified",
  "expectation": "written by the maintainer before measuring",
  "steps": [
    {"name": "setup",  "action": "M", "card": "become_the_shadow_lord_blue"},
    {"name": "gate",   "action": "M", "card": "gate_to_iarathael", "withinTurns": 2},
    {"name": "payoff", "action": "M", "set": "blood_debt", "withinTurns": 0}
  ]
}`

var sets = Sets{"blood_debt": {"deadwood_dirge_red": true}}

func ev(turn int, card, action string) game.Event {
	return game.Event{Turn: turn, Card: card, Action: action}
}

func load(t *testing.T) Spec {
	t.Helper()
	s, err := ParseSpec(strings.NewReader(specJSON), sets)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestParseSpecRejectsUnknownSetsAndEmptySteps(t *testing.T) {
	if _, err := ParseSpec(strings.NewReader(`{"id":"x","steps":[{"name":"a","action":"M","set":"nope"}]}`), sets); err == nil {
		t.Error("an unknown card set should fail")
	}
	if _, err := ParseSpec(strings.NewReader(`{"id":"x","steps":[]}`), sets); err == nil {
		t.Error("a chain needs steps")
	}
	if _, err := ParseSpec(strings.NewReader(`{"id":"x","steps":[{"name":"a","action":"M"}]}`), sets); err == nil {
		t.Error("a step needs a card or a set")
	}
}

func TestCompletedChain(t *testing.T) {
	log := []game.Event{ev(1, "become_the_shadow_lord_blue", "M"), ev(2, "gate_to_iarathael", "M"), ev(2, "deadwood_dirge_red", "M")}
	got := load(t).Match(log)
	if got.Reached != 3 || got.SetupTurn != 1 || got.PayoffTurn != 2 {
		t.Fatalf("got %+v, want all 3 steps, setup turn 1, payoff turn 2", got)
	}
}

func TestWindowsAreEnforced(t *testing.T) {
	// The Gate comes 3 turns after the setup: outside withinTurns 2.
	log := []game.Event{ev(1, "become_the_shadow_lord_blue", "M"), ev(4, "gate_to_iarathael", "M"), ev(4, "deadwood_dirge_red", "M")}
	if got := load(t).Match(log); got.Reached != 1 {
		t.Fatalf("got %+v, want only the setup", got)
	}
	// The payoff is on a later turn than the Gate: outside withinTurns 0.
	log = []game.Event{ev(1, "become_the_shadow_lord_blue", "M"), ev(2, "gate_to_iarathael", "M"), ev(3, "deadwood_dirge_red", "M")}
	if got := load(t).Match(log); got.Reached != 2 {
		t.Fatalf("got %+v, want setup and gate only", got)
	}
}

func TestOrderAndActionMatter(t *testing.T) {
	// A payoff before the Gate doesn't count, and pitching the setup card isn't playing it.
	log := []game.Event{ev(2, "deadwood_dirge_red", "M"), ev(2, "gate_to_iarathael", "M")}
	if got := load(t).Match(log); got.Reached != 0 {
		t.Fatalf("got %+v, want nothing", got)
	}
	log = []game.Event{ev(1, "become_the_shadow_lord_blue", "P"), ev(2, "gate_to_iarathael", "M"), ev(2, "deadwood_dirge_red", "M")}
	if got := load(t).Match(log); got.Reached != 0 {
		t.Fatalf("got %+v, want nothing", got)
	}
}

func TestBestAttemptWins(t *testing.T) {
	// The first setup goes nowhere; the second completes.
	log := []game.Event{
		ev(1, "become_the_shadow_lord_blue", "M"),
		ev(5, "become_the_shadow_lord_blue", "M"), ev(6, "gate_to_iarathael", "M"), ev(6, "deadwood_dirge_red", "M"),
	}
	if got := load(t).Match(log); got.Reached != 3 || got.SetupTurn != 5 {
		t.Fatalf("got %+v, want the completed attempt from turn 5", got)
	}
}

func TestRegisteredNeedsAWrittenExpectation(t *testing.T) {
	for exp, want := range map[string]bool{"": false, "  ": false, "TODO: the maintainer writes this": false, "Completes in 30-50% of games": true} {
		s := Spec{ID: "x", Expectation: exp, Steps: []Step{{Name: "a", Card: "c"}}}
		if got := s.Registered(); got != want {
			t.Errorf("Registered() with expectation %q = %v, want %v", exp, got, want)
		}
	}
}

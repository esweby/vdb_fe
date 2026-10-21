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
	if got.PayoffCard != "deadwood_dirge_red" {
		t.Fatalf("payoff card %q, want deadwood_dirge_red", got.PayoffCard)
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

func TestAStepCanMatchSeveralActions(t *testing.T) {
	spec := `{"id":"x","steps":[
	  {"name":"setup","action":"M","card":"become_the_shadow_lord_blue"},
	  {"name":"gate","actions":["M","INSTANT","A"],"card":"gate_to_iarathael","withinTurns":0}]}`
	s, err := ParseSpec(strings.NewReader(spec), sets)
	if err != nil {
		t.Fatal(err)
	}
	for _, action := range []string{"M", "INSTANT", "A"} {
		log := []game.Event{ev(1, "become_the_shadow_lord_blue", "M"), ev(1, "gate_to_iarathael", action)}
		if got := s.Match(log); got.Reached != 2 {
			t.Errorf("a Gate used as %s: got %+v, want both steps", action, got)
		}
	}
	log := []game.Event{ev(1, "become_the_shadow_lord_blue", "M"), ev(1, "gate_to_iarathael", "P")}
	if got := s.Match(log); got.Reached != 1 {
		t.Errorf("an action outside the list shouldn't match: %+v", got)
	}
	if _, err := ParseSpec(strings.NewReader(`{"id":"x","steps":[{"name":"a","action":"M","actions":["A"],"card":"c"}]}`), sets); err == nil {
		t.Error("action and actions together should fail")
	}
}

func TestUnlessRulesOutEventsBetweenSteps(t *testing.T) {
	spec := `{"id":"x","steps":[
	  {"name":"setup","action":"M","card":"become_the_shadow_lord_blue"},
	  {"name":"gate","action":"M","card":"gate_to_iarathael","withinTurns":2,
	   "unless":[{"action":"M","set":"maker_on_play"},{"action":"HIT","card":"open_the_gate_to_iarathael_red"}]},
	  {"name":"payoff","action":"M","set":"blood_debt","withinTurns":0}]}`
	s, err := ParseSpec(strings.NewReader(spec), Sets{"blood_debt": {"deadwood_dirge_red": true}, "maker_on_play": {"rites_of_nightfall_blue": true}})
	if err != nil {
		t.Fatal(err)
	}
	clean := []game.Event{ev(1, "become_the_shadow_lord_blue", "M"), ev(1, "gate_to_iarathael", "M"), ev(1, "deadwood_dirge_red", "M")}
	if got := s.Match(clean); got.Reached != 3 {
		t.Fatalf("nothing in between: got %+v, want all 3 steps", got)
	}
	for _, between := range []game.Event{ev(1, "rites_of_nightfall_blue", "M"), ev(2, "open_the_gate_to_iarathael_red", "HIT")} {
		log := []game.Event{ev(1, "become_the_shadow_lord_blue", "M"), between, ev(2, "gate_to_iarathael", "M"), ev(2, "deadwood_dirge_red", "M")}
		if got := s.Match(log); got.Reached != 1 {
			t.Errorf("%s %s in between: got %+v, want only the setup", between.Action, between.Card, got)
		}
	}
	// Only the gap before this step counts: a maker after the Gate, or a different action, doesn't rule it out.
	for _, other := range [][]game.Event{
		{ev(1, "become_the_shadow_lord_blue", "M"), ev(1, "gate_to_iarathael", "M"), ev(1, "rites_of_nightfall_blue", "M"), ev(1, "deadwood_dirge_red", "M")},
		{ev(1, "become_the_shadow_lord_blue", "M"), ev(1, "open_the_gate_to_iarathael_red", "M"), ev(1, "gate_to_iarathael", "M"), ev(1, "deadwood_dirge_red", "M")},
	} {
		if got := s.Match(other); got.Reached != 3 {
			t.Errorf("got %+v, want all 3 steps", got)
		}
	}
	if _, err := ParseSpec(strings.NewReader(`{"id":"x","steps":[{"name":"a","action":"M","card":"c","unless":[{"action":"M","set":"nope"}]}]}`), sets); err == nil {
		t.Error("an unknown set in unless should fail")
	}
	if _, err := ParseSpec(strings.NewReader(`{"id":"x","steps":[{"name":"a","action":"M","card":"c","unless":[{"action":"M"}]}]}`), sets); err == nil {
		t.Error("an unless entry needs a card or a set")
	}
}

func TestAnyOrderMatchesEitherSideInTheSameTurn(t *testing.T) {
	spec := `{"id":"x","steps":[
	  {"name":"reach","action":"B","card":"reach_of_the_abyss"},
	  {"name":"otg","action":"B","card":"open_the_gate_to_iarathael_red","withinTurns":0,"anyOrder":true},
	  {"name":"gate","action":"M","card":"gate_to_iarathael","withinTurns":1}]}`
	s, err := ParseSpec(strings.NewReader(spec), sets)
	if err != nil {
		t.Fatal(err)
	}
	after := []game.Event{ev(3, "reach_of_the_abyss", "B"), ev(3, "open_the_gate_to_iarathael_red", "B"), ev(3, "gate_to_iarathael", "M")}
	before := []game.Event{ev(3, "open_the_gate_to_iarathael_red", "B"), ev(3, "reach_of_the_abyss", "B"), ev(3, "gate_to_iarathael", "M")}
	for name, log := range map[string][]game.Event{"after": after, "before": before} {
		if got := s.Match(log); got.Reached != 3 || got.SetupTurn != 3 || got.PayoffTurn != 3 {
			t.Errorf("Open the Gate blocking %s the Reach: got %+v, want all 3 steps in turn 3", name, got)
		}
	}
	// An earlier turn doesn't count, and the next step still has to follow both.
	for name, log := range map[string][]game.Event{
		"earlier turn": {ev(2, "open_the_gate_to_iarathael_red", "B"), ev(3, "reach_of_the_abyss", "B"), ev(3, "gate_to_iarathael", "M")},
		"gate between": {ev(3, "open_the_gate_to_iarathael_red", "B"), ev(3, "gate_to_iarathael", "M"), ev(3, "reach_of_the_abyss", "B")},
	} {
		if got := s.Match(log); got.Reached == 3 {
			t.Errorf("%s: got %+v, want the chain incomplete", name, got)
		}
	}
	if _, err := ParseSpec(strings.NewReader(`{"id":"x","steps":[{"name":"a","action":"M","card":"c"},{"name":"b","action":"M","card":"d","anyOrder":true}]}`), sets); err == nil {
		t.Error("anyOrder needs withinTurns 0")
	}
}

func TestCompareFromSplitsOnANamedStep(t *testing.T) {
	spec := `{"id":"x","compareFrom":"gate","steps":[
	  {"name":"setup","action":"M","card":"become_the_shadow_lord_blue"},
	  {"name":"gate","action":"M","card":"gate_to_iarathael"},
	  {"name":"payoff","action":"M","set":"blood_debt","withinTurns":0}]}`
	s, err := ParseSpec(strings.NewReader(spec), sets)
	if err != nil {
		t.Fatal(err)
	}
	for reached, want := range map[int]bool{1: false, 2: true, 3: true} {
		if got := s.Paid(Result{Reached: reached}); got != want {
			t.Errorf("compareFrom gate, reached %d: Paid = %v, want %v", reached, got, want)
		}
	}
	// Without compareFrom, only a complete chain counts.
	for reached, want := range map[int]bool{2: false, 3: true} {
		if got := load(t).Paid(Result{Reached: reached}); got != want {
			t.Errorf("default, reached %d: Paid = %v, want %v", reached, got, want)
		}
	}
	for _, bad := range []string{"setup", "nope"} {
		if _, err := ParseSpec(strings.NewReader(`{"id":"x","compareFrom":"`+bad+`","steps":[{"name":"setup","action":"M","card":"c"},{"name":"b","action":"M","card":"d"}]}`), sets); err == nil {
			t.Errorf("compareFrom %q should fail: it must name a step after the setup", bad)
		}
	}
}

func TestAnyCardMatchesEveryCard(t *testing.T) {
	spec := `{"id":"x","steps":[
	  {"name":"traverse","action":"TRANSFORM","card":"viserai_usurper"},
	  {"name":"plays-after","action":"M","anyCard":true,"withinTurns":0}]}`
	s, err := ParseSpec(strings.NewReader(spec), sets)
	if err != nil {
		t.Fatal(err)
	}
	if got := s.Match([]game.Event{ev(2, "viserai_usurper", "TRANSFORM"), ev(2, "anything_red", "M")}); got.Reached != 2 {
		t.Errorf("any card played after: got %+v, want both steps", got)
	}
	if got := s.Match([]game.Event{ev(2, "viserai_usurper", "TRANSFORM"), ev(2, "anything_red", "P")}); got.Reached != 1 {
		t.Errorf("the action still has to match: got %+v", got)
	}
	for _, bad := range []string{
		`{"name":"b","action":"M","anyCard":true,"card":"c"}`,
		`{"name":"b","action":"M","anyCard":true,"set":"blood_debt"}`,
	} {
		if _, err := ParseSpec(strings.NewReader(`{"id":"x","steps":[{"name":"a","action":"M","card":"c"},`+bad+`]}`), sets); err == nil {
			t.Errorf("anyCard with a card or set should fail: %s", bad)
		}
	}
}

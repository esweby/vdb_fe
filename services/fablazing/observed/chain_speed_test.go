package observed

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

const speedSpec = `{"id":"bsl-gate-blood-debt","expectation":"registered before measurement","steps":[
{"name":"setup","action":"M","card":"become_the_shadow_lord_blue"},
{"name":"gate","action":"M","card":"gate_to_iarathael","withinTurns":2},
{"name":"payoff","action":"M","set":"blood_debt","withinTurns":0}]}`

func speedOptions(t *testing.T) Options {
	t.Helper()
	spec, err := ParseChainSpeed(strings.NewReader(speedSpec), strings.NewReader(`{"blood_debt":["deadwood_dirge_red"]}`))
	if err != nil {
		t.Fatal(err)
	}
	options := opts()
	options.ChainSpeed = spec
	return options
}

func speedEvent(turn int, card string) game.Event {
	return game.Event{Turn: turn, Card: card, Action: "M"}
}

func setup(turn int) game.Event  { return speedEvent(turn, "become_the_shadow_lord_blue") }
func gate(turn int) game.Event   { return speedEvent(turn, "gate_to_iarathael") }
func payoff(turn int) game.Event { return speedEvent(turn, "deadwood_dirge_red") }

func speedSide(log ...game.Event) game.Side {
	s := traverses(side("", 1, 2, 3, 4), 0)
	s.Log = append(s.Log, log...)
	return s
}

func speedJSON(t *testing.T, group Group) map[string]any {
	t.Helper()
	data, err := json.Marshal(group)
	if err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	speed, ok := value["chain_speed"].(map[string]any)
	if !ok {
		t.Fatal("missing chain_speed")
	}
	return speed
}

func TestChainSpeedBestAttemptAndDelays(t *testing.T) {
	cases := []struct {
		name    string
		log     []game.Event
		reached int
		delay   int
	}{
		{"no setup", nil, 0, -1},
		{"setup only", []game.Event{setup(0)}, 1, -1},
		{"gate only", []game.Event{setup(0), gate(1)}, 2, -1},
		{"same turn", []game.Event{setup(0), gate(0), payoff(0)}, 3, 0},
		{"one turn", []game.Event{setup(0), gate(1), payoff(1)}, 3, 1},
		{"two turns", []game.Event{setup(0), gate(2), payoff(2)}, 3, 2},
		{"later setup beats partial", []game.Event{setup(0), setup(3), gate(4), payoff(4)}, 3, 1},
		{"earliest setup wins tied completions", []game.Event{setup(0), setup(1), gate(2), payoff(2)}, 3, 2},
		{"first gate is greedy", []game.Event{setup(0), gate(0), gate(1), payoff(1)}, 2, -1},
		{"payoff must follow gate", []game.Event{setup(0), payoff(0), gate(0)}, 2, -1},
		{"gate outside window", []game.Event{setup(0), gate(3), payoff(3)}, 1, -1},
	}
	var games []game.Game
	for _, test := range cases {
		sample := g(speedSide(test.log...))
		games = append(games, sample)
		t.Run(test.name, func(t *testing.T) {
			got := Compute([]game.Game{sample}, speedOptions(t)).Pooled.ChainSpeed
			var reached [4]int
			var delays [3]int
			reached[test.reached] = 1
			if test.delay >= 0 {
				delays[test.delay] = 1
			}
			if got.Population != 1 || got.Reached != reached || got.ByDelay != delays {
				t.Fatalf("got %+v, want reached %v, delays %v", got, reached, delays)
			}
		})
	}
	got := speedJSON(t, Compute(games, speedOptions(t)).Pooled)
	want := `{"chain":"bsl-gate-blood-debt","population":11,"reached":[1,2,3,5],"by_delay":[1,2,2]}`
	var expected map[string]any
	if err := json.Unmarshal([]byte(want), &expected); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, expected) {
		t.Fatalf("got %v, want %v", got, expected)
	}
}

func TestChainSpeedUsesExistingPopulationAndGroups(t *testing.T) {
	options := speedOptions(t)
	options.PlayerCap = 1
	kept := g(speedSide(setup(0), gate(1), payoff(1)))
	kept.Sides[0].Player = "capped-player"
	capped := kept
	capped.GUID += "later"
	capped.CreatedAt = "2026-10-20 12:00:00"
	short := g(speedSide(setup(0), gate(0), payoff(0)))
	short.Sides[0].Turns = 3
	noDetail := g(speedSide(setup(0)))
	noDetail.Sides[0].Detailed = false
	abandoned := g(speedSide(setup(0)))
	abandoned.Conceded = true
	abandoned.Sides[0].Turns, abandoned.Sides[1].Turns = 2, 2
	other := g(speedSide(setup(0), gate(2), payoff(2)))
	other.Format = 1
	other.Sides[0].FirstPlayer = 0
	other.Sides[0].Opponent = "viserai_usurper"
	games := []game.Game{capped, short, noDetail, abandoned, kept, other}
	enabled := Compute(games, options)
	if enabled.Counts != (Counts{Games: 6, ViseraiSides: 6, Abandoned: 1, WithoutDetail: 1, Short: 1, Capped: 1, Kept: 2}) {
		t.Fatalf("unexpected exclusions: %+v", enabled.Counts)
	}
	groups := []Group{enabled.Pooled, enabled.ByFormat["0"], enabled.ByFormat["1"], enabled.ByFirstPlayer["1"], enabled.ByFirstPlayer["0"], enabled.ByOpponent["kano"], enabled.ByOpponent["viserai"]}
	for _, group := range groups {
		speed := speedJSON(t, group)
		if speed["population"] != float64(group.Sides) || speed["reached"].([]any)[3] != float64(group.Sides) {
			t.Fatalf("group counts differ: %+v", speed)
		}
	}
	if enabled.Pooled.ChainSpeed.ByDelay != [3]int{0, 1, 1} || enabled.ByFormat["0"].ChainSpeed.ByDelay != [3]int{0, 1, 0} || enabled.ByFormat["1"].ChainSpeed.ByDelay != [3]int{0, 0, 1} || enabled.ByFirstPlayer["1"].ChainSpeed.ByDelay != [3]int{0, 1, 0} || enabled.ByFirstPlayer["0"].ChainSpeed.ByDelay != [3]int{0, 0, 1} || enabled.ByOpponent["kano"].ChainSpeed.ByDelay != [3]int{0, 1, 0} || enabled.ByOpponent["viserai"].ChainSpeed.ByDelay != [3]int{0, 0, 1} {
		t.Fatal("delay counts assigned to the wrong group")
	}
	options.ChainSpeed = nil
	plain := Compute(games, options)
	data, _ := json.Marshal(plain)
	if strings.Contains(string(data), "chain_speed") {
		t.Fatal("default output includes chain_speed")
	}
	var with, without any
	withData, _ := json.Marshal(enabled)
	json.Unmarshal(withData, &with)
	json.Unmarshal(data, &without)
	var strip func(any)
	strip = func(value any) {
		if object, ok := value.(map[string]any); ok {
			delete(object, "chain_speed")
			for _, child := range object {
				strip(child)
			}
		}
	}
	strip(with)
	if !reflect.DeepEqual(with, without) {
		t.Fatal("existing metrics changed")
	}
}

func TestDefaultGroupJSONBytesUnchanged(t *testing.T) {
	result := Compute([]game.Game{g(speedSide())}, opts())
	for _, group := range []Group{result.Pooled, result.ByFormat["0"], result.ByFirstPlayer["1"], result.ByOpponent["kano"]} {
		legacy := struct {
			Sides         int           `json:"sides"`
			ByTurn        []Turn        `json:"by_turn"`
			FirstTraverse FirstTraverse `json:"first_traverse"`
		}{group.Sides, group.ByTurn, group.FirstTraverse}
		got, err := json.MarshalIndent(group, "", "  ")
		if err != nil {
			t.Fatal(err)
		}
		want, err := json.MarshalIndent(legacy, "", "  ")
		if err != nil {
			t.Fatal(err)
		}
		if string(got) != string(want) {
			t.Fatalf("default JSON changed: %s", got)
		}
	}
}

func TestChainSpeedEmptyPopulationAndBatchSnapshots(t *testing.T) {
	options := speedOptions(t)
	ob := New(options)
	empty := ob.Result().Pooled.ChainSpeed
	if empty == nil || *empty != (ChainSpeed{Chain: "bsl-gate-blood-debt"}) {
		t.Fatalf("empty measurement: %+v", empty)
	}
	first := g(speedSide(setup(0), gate(0), payoff(0)))
	second := g(speedSide(setup(0), gate(1), payoff(1)))
	ob.Add([]game.Game{first})
	snapshot := ob.Result()
	ob.Add([]game.Game{second})
	if snapshot.Pooled.ChainSpeed.Population != 1 || snapshot.ByFormat["0"].ChainSpeed.Population != 1 {
		t.Fatal("adding a batch mutated an earlier result")
	}
	if !reflect.DeepEqual(ob.Result(), Compute([]game.Game{first, second}, options)) {
		t.Fatal("batched chain counts differ")
	}
}

func TestChainSpeedStrictActionsAndOneCompletionPerSide(t *testing.T) {
	cases := []struct {
		name    string
		log     []game.Event
		reached [4]int
		delays  [3]int
	}{
		{"multiple complete setups count once", []game.Event{setup(0), gate(0), payoff(0), setup(1), gate(3), payoff(3)}, [4]int{0, 0, 0, 1}, [3]int{1, 0, 0}},
		{"payoff on later turn is partial", []game.Event{setup(0), gate(1), payoff(2)}, [4]int{0, 0, 1, 0}, [3]int{}},
		{"instant gate is not M", []game.Event{setup(0), {Turn: 0, Card: "gate_to_iarathael", Action: "INSTANT"}, payoff(0)}, [4]int{0, 1, 0, 0}, [3]int{}},
		{"pitched BSL is not setup", []game.Event{{Turn: 0, Card: "become_the_shadow_lord_blue", Action: "P"}, gate(0), payoff(0)}, [4]int{1, 0, 0, 0}, [3]int{}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			got := Compute([]game.Game{g(speedSide(test.log...))}, speedOptions(t)).Pooled.ChainSpeed
			if got.Population != 1 || got.Reached != test.reached || got.ByDelay != test.delays {
				t.Fatalf("got %+v, want reached %v, delays %v", got, test.reached, test.delays)
			}
		})
	}
}

func TestParseChainSpeedRejectsInvalidInputs(t *testing.T) {
	cases := []struct{ name, spec, sets string }{
		{"malformed spec", "{", `{"blood_debt":["deadwood_dirge_red"]}`},
		{"malformed sets", speedSpec, "{"},
		{"missing blood debt", speedSpec, `{}`},
		{"empty blood debt", speedSpec, `{"blood_debt":[]}`},
		{"empty card id", speedSpec, `{"blood_debt":[""]}`},
		{"unregistered", strings.Replace(speedSpec, "registered before measurement", "TODO", 1), `{"blood_debt":["deadwood_dirge_red"]}`},
		{"comparison override", strings.Replace(speedSpec, `"steps":`, `"compareFrom":"gate","steps":`, 1), `{"blood_debt":["deadwood_dirge_red"]}`},
		{"missing window", strings.Replace(speedSpec, `,"withinTurns":2`, "", 1), `{"blood_debt":["deadwood_dirge_red"]}`},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if _, err := ParseChainSpeed(strings.NewReader(test.spec), strings.NewReader(test.sets)); err == nil {
				t.Fatal("invalid chain inputs accepted")
			}
		})
	}
}

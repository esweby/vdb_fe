package turntypes

import (
	"reflect"
	"strings"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

func opts() Options {
	return Options{MinTurns: 4, Concession: game.ConcessionRule{MaxTurns: 2, MaxLife: 20}, PlayerCap: 20, Rounds: 4, BurstAt: 9, DefendBlocks: 2}
}

// side is a detailed Viserai side with damage threatened threatened[i] on round i.
func side(player string, won bool, threatened ...int) game.Side {
	ts := make([]game.TurnStats, len(threatened))
	for i, d := range threatened {
		ts[i] = game.TurnStats{DamageThreatened: d, Recorded: true}
	}
	return game.Side{
		Hero: "viserai_the_forsaken", Opponent: "kano", Player: game.PlayerHash(player), Won: won,
		Turns: len(threatened), FirstPlayer: 1, Detailed: true, TurnStats: ts,
		Character: []string{"viserai_the_forsaken", "seven_sin_nebula", "grasp_of_the_arknight"},
	}
}

func with(s game.Side, round int, actions ...string) game.Side {
	for _, a := range actions {
		action, card, _ := strings.Cut(a, " ")
		s.Log = append(s.Log, game.Event{Turn: round, Card: card, Action: action})
	}
	return s
}

var n int

func g(a game.Side) game.Game {
	n++
	opp := game.Side{Hero: "kano", Opponent: a.Hero, Player: "opp", Turns: a.Turns, Detailed: true}
	return game.Game{GUID: strings.Repeat("g", n), Format: 0, CreatedAt: "2026-10-20 10:00:00", Sides: [2]game.Side{a, opp}}
}

func TestClassify(t *testing.T) {
	o := opts()
	cases := []struct {
		name string
		s    game.Side
		want string
	}{
		{"nine threatened is a burst", side("p", true, 9), "burst"},
		{"two hand blocks defend", with(side("p", true, 3), 0, "B murmuring_gloomblade_red", "D sink_below_red", "M enshrine_sin_blue"), "defend"},
		{"equipment blocks don't count", with(side("p", true, 3), 0, "B grasp_of_the_arknight", "B murmuring_gloomblade_red", "M enshrine_sin_blue"), "build"},
		{"a burst outranks blocking", with(side("p", true, 12), 0, "B murmuring_gloomblade_red", "B cull_red"), "burst"},
		{"a weapon swing alone is quiet", with(side("p", true, 3), 0, "M seven_sin_nebula", "M gate_to_iarathael"), "quiet"},
		{"nothing is quiet", side("p", true, 0), "quiet"},
		{"traversing to the Usurper adds flip", with(side("p", true, 4), 0, "M become_the_shadow_lord_blue", "TRANSFORM viserai_usurper"), "build+flip"},
		{"traversing back alone is back, not a flip", with(side("p", true, 4), 0, "M become_the_shadow_lord_blue", "TRANSFORM viserai_the_forsaken"), "build+back"},
		{"there and back in one turn", with(side("p", true, 4), 0, "M become_the_shadow_lord_blue", "TRANSFORM viserai_usurper", "TRANSFORM viserai_the_forsaken"), "build+flip+back"},
	}
	for _, c := range cases {
		if got := Classify(c.s, 0, o); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestComputeTalliesKeptSidesByRoundAndSequence(t *testing.T) {
	burstWin := with(side("a", true, 2, 3, 10, 12), 0, "B cull_red", "B murmuring_gloomblade_red")
	burstLoss := with(side("b", false, 2, 3, 10, 12), 0, "B cull_red", "B murmuring_gloomblade_red")
	short := side("c", true, 9, 9, 9)
	noDetail := side("d", true, 9, 9, 9, 9)
	noDetail.Detailed = false
	abandoned := g(side("e", false, 0, 0, 0, 0))
	abandoned.Conceded = true
	abandoned.Sides[0].Turns, abandoned.Sides[1].Turns = 2, 2

	r := Compute([]game.Game{g(burstWin), g(burstLoss), g(short), g(noDetail), abandoned}, opts())

	if want := (Counts{Games: 5, ViseraiSides: 5, Abandoned: 1, WithoutDetail: 1, Short: 1, Kept: 2}); r.Counts != want {
		t.Fatalf("counts = %+v, want %+v", r.Counts, want)
	}
	if got := r.ByRound[0]["defend"]; got != (Tally{Sides: 2, Wins: 1}) {
		t.Fatalf("round 0 defend = %+v", got)
	}
	if got := r.ByRound[2]["burst"]; got != (Tally{Sides: 2, Wins: 1}) {
		t.Fatalf("round 2 burst = %+v", got)
	}
	if got := r.Sequences["defend > quiet > burst > burst"]; got != (Tally{Sides: 2, Wins: 1}) {
		t.Fatalf("sequences = %+v", r.Sequences)
	}
	if len(r.ByRound) != 4 {
		t.Fatalf("rounds = %d, want 4", len(r.ByRound))
	}
}

func TestCardsAreCountedByTurnTypeAndAction(t *testing.T) {
	s := with(side("a", true, 0, 0, 0, 0), 0,
		"B murmuring_gloomblade_red", "B murmuring_gloomblade_red", "P shadow_of_ursur_blue", "M enshrine_sin_blue", "B grasp_of_the_arknight")
	r := Compute([]game.Game{g(s)}, opts())
	want := map[string]map[string]int{
		"blocked": {"murmuring_gloomblade_red": 2},
		"pitched": {"shadow_of_ursur_blue": 1},
		"played":  {"enshrine_sin_blue": 1},
	}
	if got := r.Cards["defend"]; !reflect.DeepEqual(got, want) {
		t.Fatalf("defend cards = %+v, want %+v", got, want)
	}
}

func TestPlayerCapLeavesOutLaterSides(t *testing.T) {
	o := opts()
	o.PlayerCap = 1
	r := Compute([]game.Game{g(side("a", true, 1, 1, 1, 1)), g(side("a", true, 1, 1, 1, 1))}, o)
	if r.Counts.Kept != 1 || r.Counts.Capped != 1 {
		t.Fatalf("counts = %+v", r.Counts)
	}
}

func TestTalliesSplitByWhoWentFirst(t *testing.T) {
	first := with(side("a", true, 0, 0, 0, 0), 0, "B cull_red", "B murmuring_gloomblade_red")
	second := with(side("b", false, 0, 0, 0, 0, 0), 0, "B cull_red", "B murmuring_gloomblade_red")
	second.FirstPlayer = 0
	r := Compute([]game.Game{g(first), g(second)}, opts())

	if got := r.ByFirst["first"]; got.Kept != 1 || got.ByRound[0]["defend"] != (Tally{Sides: 1, Wins: 1}) {
		t.Fatalf("first = %+v", got)
	}
	if got := r.ByFirst["second"]; got.Kept != 1 || got.ByRound[0]["defend"] != (Tally{Sides: 1}) ||
		got.Sequences["defend > quiet > quiet > quiet"] != (Tally{Sides: 1}) {
		t.Fatalf("second = %+v", got)
	}
}

// Going first, a round is the opponent's turn before yours, then yours: round
// 0 is only your first turn. Going second, round 0 is only the opponent's first
// turn and each later round is yours, then the opponent's next (fablazing logs).
func TestOwnTurnsGoingFirst(t *testing.T) {
	s := with(side("a", true, 3, 10, 0, 0), 0, "M malefic_incantation_red")
	s = with(s, 1, "B cull_red", "B murmuring_gloomblade_red", "M murmuring_gloomblade_red")
	o := opts()
	if got := Classify(s, 0, o); got != "build" {
		t.Errorf("own turn 1 = %q, want build", got)
	}
	if got := Classify(s, 1, o); got != "burst" {
		t.Errorf("own turn 2 = %q, want burst (round 1's threatened)", got)
	}
}

func TestOwnTurnsGoingSecond(t *testing.T) {
	s := with(side("a", true, 0, 10, 2, 0, 0), 0, "B cull_red", "B murmuring_gloomblade_red")
	s = with(s, 1, "M murmuring_gloomblade_red", "TRANSFORM viserai_usurper", "B embrace_ursur_red", "D sink_below_red", "P shadow_of_ursur_blue")
	s = with(s, 2, "M enshrine_sin_blue")
	s.FirstPlayer = 0
	o := opts()
	if got := Classify(s, 0, o); got != "burst+flip" {
		t.Errorf("own turn 1 = %q, want burst+flip (round 0's blocks, round 1's own part)", got)
	}
	if got := Classify(s, 1, o); got != "defend" {
		t.Errorf("own turn 2 = %q, want defend (round 1's later blocks, round 2's 2 threatened)", got)
	}
	r := Compute([]game.Game{g(s)}, o)
	if got := r.Cards["defend"]["pitched"]["shadow_of_ursur_blue"]; got != 1 {
		t.Errorf("a pitch in the opponent's turn goes with the blocks: %+v", r.Cards["defend"])
	}
}

func TestGoingSecondNeedsARoundMoreForTheSameOwnTurns(t *testing.T) {
	s := side("a", true, 0, 0, 0, 0)
	s.FirstPlayer = 0
	r := Compute([]game.Game{g(s)}, opts())
	if r.Counts.Short != 1 || r.Counts.Kept != 0 {
		t.Fatalf("counts = %+v", r.Counts)
	}
}

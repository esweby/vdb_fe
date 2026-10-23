package observed

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

func opts() Options {
	return Options{MinTurns: 4, Concession: game.ConcessionRule{MaxTurns: 2, MaxLife: 20}, PlayerCap: 20, TurnIndexes: 4}
}

// side is a detailed Viserai side of n turn indexes, with arcane damage
// arcane[i] (and damage 2*arcane[i], threatened 3*arcane[i]) on index i.
func side(player string, arcane ...int) game.Side {
	ts := make([]game.TurnStats, len(arcane))
	for i, a := range arcane {
		ts[i] = game.TurnStats{ArcaneDealt: a, DamageDealt: 2 * a, DamageThreatened: 3 * a, LifeAtEnd: 30, OpponentLifeAtEnd: 30, HasLife: true, Recorded: true}
	}
	return game.Side{Hero: "viserai_the_forsaken", Opponent: "kano", Player: game.PlayerHash(player), Turns: len(arcane), FirstPlayer: 1, Detailed: true, TurnStats: ts}
}

func opposingSide(player string, turns int) game.Side {
	return game.Side{Hero: "kano", Opponent: "viserai_the_forsaken", Player: game.PlayerHash(player), Turns: turns, Detailed: true}
}

func traverses(s game.Side, at ...int) game.Side {
	for _, t := range at {
		s.Log = append(s.Log, game.Event{Turn: t, Card: "viserai_usurper", Action: "TRANSFORM"})
	}
	return s
}

var n int

func g(a game.Side) game.Game {
	n++
	return game.Game{GUID: strings.Repeat("g", n), Format: 0, CreatedAt: "2026-10-20 10:00:00", Sides: [2]game.Side{a, opposingSide("opp", a.Turns)}}
}

func TestOnlyDetailedViseraiSidesOfLongEnoughGamesCount(t *testing.T) {
	short := g(side("a", 1, 1, 1))
	noDetail := g(side("b", 1, 1, 1, 1))
	noDetail.Sides[0].Detailed = false
	abandoned := g(side("c", 0, 0, 0, 0))
	abandoned.Conceded = true
	abandoned.Sides[0].Turns, abandoned.Sides[1].Turns = 2, 2
	kept := g(side("d", 1, 1, 1, 1))

	r := Compute([]game.Game{short, noDetail, abandoned, kept}, opts())
	if r.Pooled.Sides != 1 {
		t.Fatalf("pooled sides = %d, want 1", r.Pooled.Sides)
	}
	want := Counts{Games: 4, ViseraiSides: 4, Abandoned: 1, Short: 1, WithoutDetail: 1, Kept: 1}
	if r.Counts != want {
		t.Fatalf("counts = %+v, want %+v", r.Counts, want)
	}
}

func TestDistributionsByTurnIndex(t *testing.T) {
	var games []game.Game
	for _, a := range []int{0, 0, 1, 2, 5} {
		games = append(games, g(side("p", a, 0, 0, 0)))
	}
	r := Compute(games, opts())
	got := r.Pooled.ByTurn[0]
	if got.TurnIndex != 0 {
		t.Fatalf("turn index %d", got.TurnIndex)
	}
	want := Dist{N: 5, Counts: []int{2, 1, 1, 0, 0, 1}, Median: 1, P2_5: 0, P97_5: 5}
	if !reflect.DeepEqual(got.Arcane, want) {
		t.Fatalf("arcane = %+v, want %+v", got.Arcane, want)
	}
	if got.Damage.Median != 2 || got.Threatened.P97_5 != 15 {
		t.Fatalf("damage %+v threatened %+v", got.Damage, got.Threatened)
	}
	if len(r.Pooled.ByTurn) != 4 {
		t.Fatalf("turn indexes reported: %d, want 4", len(r.Pooled.ByTurn))
	}
}

func TestTurnsNotRecordedAreLeftOutOfThatTurn(t *testing.T) {
	s := side("p", 1, 1, 1, 1)
	s.TurnStats[2].Recorded = false
	r := Compute([]game.Game{g(s), g(side("q", 1, 1, 1, 1))}, opts())
	if r.Pooled.ByTurn[2].Arcane.N != 1 || r.Pooled.ByTurn[1].Arcane.N != 2 {
		t.Fatalf("by turn: %+v", r.Pooled.ByTurn)
	}
}

func TestFirstTraverseToTheUsurper(t *testing.T) {
	back := traverses(side("a", 0, 0, 0, 0), 2, 3)
	back.Log = append([]game.Event{{Turn: 1, Card: "viserai_the_forsaken", Action: "TRANSFORM"}}, back.Log...)
	games := []game.Game{
		g(traverses(side("b", 0, 0, 0, 0), 0)),
		g(traverses(side("c", 0, 0, 0, 0), 1, 1)),
		g(back),
		g(side("d", 0, 0, 0, 0)),
	}
	got := Compute(games, opts()).Pooled.FirstTraverse
	want := FirstTraverse{Sides: 4, Never: 1, ByTurnIndex: []int{1, 1, 1}, Median: 1, P2_5: 0, P97_5: 2}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("first traverse = %+v, want %+v", got, want)
	}
}

func TestPlayerCapIsPerDayAndFormatEarliestFirst(t *testing.T) {
	o := opts()
	o.PlayerCap = 2
	var games []game.Game
	for i, at := range []string{"2026-10-20 12:00:00", "2026-10-20 09:00:00", "2026-10-20 10:00:00", "2026-10-21 08:00:00"} {
		x := g(side("p", i, 0, 0, 0))
		x.CreatedAt = at
		games = append(games, x)
	}
	r := Compute(games, o)
	if r.Counts.Capped != 1 || r.Pooled.Sides != 3 {
		t.Fatalf("capped %d, sides %d", r.Counts.Capped, r.Pooled.Sides)
	}
	// The 12:00 game (arcane 0) is the one left out.
	if r.Pooled.ByTurn[0].Arcane.Counts[0] != 0 {
		t.Fatalf("the latest game wasn't the one capped: %+v", r.Pooled.ByTurn[0].Arcane)
	}
}

func TestGroupsByFormatFirstPlayerAndOpponent(t *testing.T) {
	a := g(side("a", 1, 1, 1, 1))
	b := g(side("b", 1, 1, 1, 1))
	b.Format = 1
	b.Sides[0].FirstPlayer = 2
	b.Sides[0].Opponent = "viserai_usurper"
	r := Compute([]game.Game{a, b}, opts())
	if r.ByFormat["0"].Sides != 1 || r.ByFormat["1"].Sides != 1 {
		t.Fatalf("by format: %v", r.ByFormat)
	}
	if r.ByFirstPlayer["1"].Sides != 1 || r.ByFirstPlayer["2"].Sides != 1 {
		t.Fatalf("by first player: %v", r.ByFirstPlayer)
	}
	if r.ByOpponent["kano"].Sides != 1 || r.ByOpponent["viserai"].Sides != 1 {
		t.Fatalf("by opponent: %v", r.ByOpponent)
	}
}

func TestPercentilesAreNearestRank(t *testing.T) {
	d := dist([]int{3, 1, 4, 1, 5, 9, 2, 6})
	if d.Median != 3 || d.P2_5 != 1 || d.P97_5 != 9 {
		t.Fatalf("%+v", d)
	}
	if empty := dist(nil); empty.N != 0 || empty.Counts == nil {
		t.Fatalf("empty: %+v", empty)
	}
}

func TestOutputHasNoPlayerHashes(t *testing.T) {
	r := Compute([]game.Game{g(side("secret-player", 1, 1, 1, 1))}, opts())
	b, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), "secret-player") {
		t.Fatal("player hash in output")
	}
}

func TestBatchesAddUp(t *testing.T) {
	a, b := g(side("p", 1, 0, 0, 0)), g(side("q", 3, 0, 0, 0))
	ob := New(opts())
	ob.Add([]game.Game{a})
	ob.Add([]game.Game{b})
	if got, want := ob.Result(), Compute([]game.Game{a, b}, opts()); !reflect.DeepEqual(got, want) {
		t.Fatalf("batched %+v, all at once %+v", got, want)
	}
}

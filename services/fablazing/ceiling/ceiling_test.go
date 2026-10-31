package ceiling

import (
	"math"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/archetypes"
	"github.com/esweby/vdb_fe/services/fablazing/game"
)

func side(player string, won bool) game.Side {
	return game.Side{Hero: "viserai_usurper", Player: game.PlayerHash(player), Won: won}
}

func TestSplitReportsBlockSlopAndFatigueApart(t *testing.T) {
	plain, slop, tired, both := side("a", true), side("b", true), side("c", true), side("d", false)
	slop.Opponent, both.Opponent = "slop", "slop"
	tired.Fatigue, both.Fatigue = true, true
	isSlop := func(s game.Side) bool { return s.Opponent == "slop" }

	s := Split([]game.Side{plain, slop, tired, both}, isSlop)
	if len(s.Main) != 1 || s.Main[0].Player != "a" {
		t.Errorf("main: %+v", s.Main)
	}
	// A block slop side decided by fatigue counts as block slop.
	if len(s.BlockSlop) != 2 || len(s.Fatigue) != 1 || s.Fatigue[0].Player != "c" {
		t.Errorf("block slop %d, fatigue %+v", len(s.BlockSlop), s.Fatigue)
	}
}

func TestPilotsWithEnoughGamesAreRankedByTheirIntervalsLowerEdge(t *testing.T) {
	var sides []game.Side
	add := func(player string, wins, games int) {
		for i := 0; i < games; i++ {
			sides = append(sides, side(player, i < wins))
		}
	}
	add("lucky", 8, 10)   // too few games
	add("steady", 30, 50) // 60%
	add("long", 60, 100)  // the same 60%, tighter

	got := Pilots(sides, 50)
	if len(got) != 2 {
		t.Fatalf("got %d pilots, want 2", len(got))
	}
	if got[0].Games != 100 || got[1].Games != 50 {
		t.Fatalf("order: %+v", got)
	}
	p := got[1]
	if p.Wins != 30 || math.Abs(p.Rate-0.6) > 1e-9 || math.Abs(p.Low-0.4618) > 0.001 || math.Abs(p.High-0.7239) > 0.001 {
		t.Errorf("steady: %+v", p)
	}
}

func TestTheBlockSlopArchetypeRunsTheMostDefenceMarkers(t *testing.T) {
	r := archetypes.Result{Archetypes: []archetypes.Archetype{
		{Inclusion: map[string]float64{"sink_below_red": 0.1, "ripple_away_blue": 0.0}},
		{Inclusion: map[string]float64{"sink_below_red": 0.9, "ripple_away_blue": 0.6}},
		{Inclusion: map[string]float64{"sink_below_red": 0.5}},
	}}
	if got := BlockSlopArchetype(r, []string{"sink_below_red", "ripple_away_blue"}); got != 1 {
		t.Errorf("got %d, want 1", got)
	}
}

func listed(player string, won bool, cards ...string) game.Side {
	s := side(player, won)
	for _, c := range cards {
		s.Cards = append(s.Cards, game.Card{ID: c, Copies: 1})
	}
	return s
}

func TestAPilotsSignatureIsTheCardsInMostOfTheirLists(t *testing.T) {
	sides := []game.Side{
		listed("top", true, "a", "b", "c"),
		listed("top", true, "a", "b", "d"),
		listed("top", false, "a", "e"),
		listed("other", true, "x", "y", "z"),
	}
	got := Signature(sides, "top", 0.5)
	if len(got) != 2 || !got["a"] || !got["b"] {
		t.Errorf("got %v, want a and b", got)
	}
}

func TestLookalikesByOthersLeaveThePilotOut(t *testing.T) {
	sig := map[string]bool{"a": true, "b": true, "c": true}
	sides := []game.Side{
		listed("top", true, "a", "b", "c"),       // the pilot
		listed("copy", false, "a", "b", "c"),     // identical
		listed("near", true, "a", "b", "c", "d"), // 3/4
		listed("far", true, "a", "x", "y"),       // 1/5
	}
	got := LookalikesByOthers(sides, "top", sig, 0.7)
	if len(got) != 2 || got[0].Player != "copy" || got[1].Player != "near" {
		t.Errorf("got %+v", got)
	}
}

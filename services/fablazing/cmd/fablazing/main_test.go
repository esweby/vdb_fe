package main

import (
	"reflect"
	"strings"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/turntypes"
)

func side(hero, player string) game.Side {
	return game.Side{Hero: hero, Opponent: "fang", Player: game.PlayerHash(player), Detailed: true, Turns: 5,
		TurnStats: make([]game.TurnStats, 5)}
}

func TestChainSidesApplyThePlayerCap(t *testing.T) {
	mk := func(guid string, a, b game.Side) game.Game {
		return game.Game{GUID: guid, CreatedAt: "2026-10-20 10:00:0" + guid, Sides: [2]game.Side{a, b}}
	}
	games := []game.Game{
		mk("3", side("viserai_usurper", "p"), side("fang", "x")),
		mk("1", side("viserai_usurper", "p"), side("fang", "x")),
		mk("2", side("fang", "p"), side("viserai_the_forsaken", "q")),
	}
	var got []string
	c := chainSides(games, 2, func(g game.Game, s game.Side) { got = append(got, g.GUID+s.Hero) })
	want := []string{"1viserai_usurper", "2viserai_the_forsaken"}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Errorf("sides: %v, want %v", got, want)
	}
	if c.capped != 1 {
		t.Errorf("capped Viserai sides: %d, want 1", c.capped)
	}
	got = nil
	if c := chainSides(games, 0, func(g game.Game, s game.Side) { got = append(got, g.GUID) }); len(got) != 3 || c.capped != 0 {
		t.Errorf("no cap: %v, %+v", got, c)
	}
}

func TestChainSidesLeaveOutAbandonedGames(t *testing.T) {
	a := side("viserai_usurper", "p")
	a.Turns, a.TurnStats = 1, []game.TurnStats{{HasLife: true, LifeAtEnd: 40, Recorded: true}}
	b := side("fang", "x")
	b.Turns, b.TurnStats = 1, a.TurnStats
	games := []game.Game{{GUID: "1", Conceded: true, Sides: [2]game.Side{a, b}}}
	n := 0
	c := chainSides(games, 20, func(game.Game, game.Side) { n++ })
	if n != 0 || c.abandoned != 1 {
		t.Errorf("abandoned: called %d times, %+v", n, c)
	}
}

func TestByCountListsCommonestFirstAboveTheMinimum(t *testing.T) {
	m := map[string]turntypes.Tally{"a": {Sides: 5}, "b": {Sides: 60}, "c": {Sides: 60}, "d": {Sides: 70}}
	got := byCount(m, 50)
	want := []string{"d", "b", "c"}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Errorf("byCount: %v, want %v", got, want)
	}
}

func TestReadListSplitsMainFromSideboard(t *testing.T) {
	main, side, err := readList(strings.NewReader("# a comment\n3 cull_red\n2 sinspeaker_gloomblade_red\n\nsideboard\n1 sinspeaker_gloomblade_red\n2 call_for_backup_red\n"))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(main, map[string]int{"cull_red": 3, "sinspeaker_gloomblade_red": 2}) || !reflect.DeepEqual(side, map[string]int{"sinspeaker_gloomblade_red": 1, "call_for_backup_red": 2}) {
		t.Fatalf("main = %v, side = %v", main, side)
	}
	if _, _, err := readList(strings.NewReader("three cull_red\n")); err == nil {
		t.Fatal("a line without a count should fail")
	}
}

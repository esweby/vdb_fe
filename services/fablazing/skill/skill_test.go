package skill

import (
	"bytes"
	"math"
	"reflect"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

func sides(player, hero string, wins, games int) []game.Side {
	var out []game.Side
	for i := 0; i < games; i++ {
		out = append(out, game.Side{Player: game.PlayerHash(player), Hero: hero, Opponent: "kano", Won: i < wins})
	}
	return out
}

func TestRecordsSplitEachPlayersViseraiAndOtherHeroes(t *testing.T) {
	v := sides("a", "viserai_usurper", 3, 10)
	others := append(sides("a", "fang", 6, 10), sides("a", "viserai_the_forsaken", 9, 10)...) // Viserai in others is ignored
	others = append(others, sides("b", "fang", 5, 10)...)                                     // no Viserai games
	got := Records(v, others)
	if len(got) != 1 {
		t.Fatalf("got %d players, want 1", len(got))
	}
	p := got[0]
	if p.Viserai != (Record{10, 3}) || p.Other != (Record{10, 6}) {
		t.Errorf("got %+v", p)
	}
}

func players() []Player {
	return []Player{
		{Player: "a", Viserai: Record{20, 6}, Other: Record{20, 10}},  // 30 vs 50
		{Player: "b", Viserai: Record{20, 10}, Other: Record{20, 14}}, // 50 vs 70
		{Player: "c", Viserai: Record{5, 5}, Other: Record{20, 20}},   // too few Viserai games
	}
}

func TestPairedGapIsTheMeanOfEachPlayersDifference(t *testing.T) {
	g := Paired(players(), 20, 500, 1)
	if g.Players != 2 || math.Abs(g.Viserai-0.4) > 1e-9 || math.Abs(g.Other-0.6) > 1e-9 || math.Abs(g.Gap+0.2) > 1e-9 {
		t.Fatalf("got %+v", g)
	}
	if math.Abs(g.Low+0.2) > 1e-9 || math.Abs(g.High+0.2) > 1e-9 {
		t.Errorf("both players differ by 20 points, so the interval is that point: %+v", g)
	}
}

func TestBandsGroupPlayersByTheirOtherHeroRate(t *testing.T) {
	got := Bands(players(), 20, []float64{0.4, 0.6})
	if len(got) != 3 {
		t.Fatalf("got %d bands", len(got))
	}
	if got[0].Players != 0 || got[1].Players != 1 || got[1].Viserai != (Record{20, 6}) || got[2].Players != 1 || got[2].Viserai != (Record{20, 10}) {
		t.Errorf("got %+v", got)
	}
	if got[1].From != 0.4 || got[1].To != 0.6 || got[2].To != 1 {
		t.Errorf("edges: %+v", got)
	}
}

func TestSummaryRowsRoundTrip(t *testing.T) {
	want := []Row{
		{Date: "2026-10-20", Format: 1, Player: "p1", Hero: "fang", Opponent: "viserai_usurper", Won: true},
		{Date: "2026-10-20", Format: 1, Player: "p2", Hero: "viserai_usurper", Opponent: "fang", Fatigue: true},
	}
	var buf bytes.Buffer
	if err := WriteRows(&buf, want); err != nil {
		t.Fatal(err)
	}
	got, err := ReadRows(&buf)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v", got)
	}
	if s := got[0].Side(); s.Player != "p1" || s.Hero != "fang" || !s.Won || s.Fatigue {
		t.Errorf("side: %+v", s)
	}
}

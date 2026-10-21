package game

import (
	"os"
	"testing"
)

func readFixture(t *testing.T) []Game {
	t.Helper()
	f, err := os.Open("testdata/games.csv")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	games, err := ReadAll(f)
	if err != nil {
		t.Fatal(err)
	}
	return games
}

func byGUID(t *testing.T, games []Game, guid string) Game {
	t.Helper()
	for _, g := range games {
		if g.GUID == guid {
			return g
		}
	}
	t.Fatalf("game %s not found", guid)
	return Game{}
}

func TestReadAllKeepsTheLatestCopyOfADuplicatedGame(t *testing.T) {
	games := readFixture(t)
	if len(games) != 4 {
		t.Fatalf("got %d games, want 4 (g-c deduplicated)", len(games))
	}
	if got := byGUID(t, games, "g-c").Sides[0].Turns; got != 7 {
		t.Fatalf("g-c kept the copy with %d turns, want the later copy with 7", got)
	}
}

func TestSideFields(t *testing.T) {
	g := byGUID(t, readFixture(t), "g-a")
	if g.Format != 1 || g.ID != "100" || g.Conceded {
		t.Fatalf("game fields: %+v", g)
	}
	s := g.Sides[0]
	if s.Hero != "viserai_the_forsaken" || s.Opponent != "fang_dracai_of_blades" || !s.Won || s.Turns != 5 {
		t.Fatalf("side fields: %+v", s)
	}
	if !s.Detailed || len(s.Cards) != 2 || s.Cards[0].ID != "become_the_shadow_lord_blue" || s.Cards[0].Copies != 3 || s.Cards[1].Hits != 1 {
		t.Fatalf("cards: %+v", s.Cards)
	}
	if len(s.Log) != 6 || s.Log[2] != (Event{Turn: 2, Card: "gate_to_iarathael", Action: "M"}) {
		t.Fatalf("log: %+v", s.Log)
	}
	if len(s.TurnStats) != 5 || s.TurnStats[3].DamageDealt != 3 {
		t.Fatalf("turn stats: %+v", s.TurnStats)
	}
}

func TestSideWithoutDetail(t *testing.T) {
	s := byGUID(t, readFixture(t), "g-b").Sides[0]
	if s.Detailed || s.Cards != nil || s.Log != nil {
		t.Fatalf("a side with no cardResults is not detailed: %+v", s)
	}
}

func TestViseraiIsOneHeroWhicheverSideItEndedOn(t *testing.T) {
	if !IsViserai("viserai_the_forsaken") || !IsViserai("viserai_usurper") || IsViserai("levia_shadowborn_abomination") {
		t.Fatal("IsViserai")
	}
}

func TestAbandoned(t *testing.T) {
	games := readFixture(t)
	rule := ConcessionRule{MaxTurns: 2, MaxLife: 20}
	if !byGUID(t, games, "g-b").Abandoned(rule) {
		t.Error("an early concession at full life is abandoned")
	}
	if byGUID(t, games, "g-d").Abandoned(rule) {
		t.Error("an early concession at 15 life counts as a result")
	}
	if byGUID(t, games, "g-a").Abandoned(rule) {
		t.Error("a game without a concession is never abandoned")
	}
}

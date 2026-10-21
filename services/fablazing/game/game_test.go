package game

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
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

func TestLifeDiffGoingIntoATurn(t *testing.T) {
	s := byGUID(t, readFixture(t), "g-a").Sides[0]
	// Turn 0 starts level. Going into turn 3 is the end of turn 2: life 40 v 38.
	for turn, want := range map[int]int{0: 0, 3: 2} {
		if got, ok := s.LifeDiffBefore(turn); !ok || got != want {
			t.Errorf("LifeDiffBefore(%d) = %d, %v; want %d", turn, got, ok, want)
		}
	}
	if _, ok := byGUID(t, readFixture(t), "g-b").Sides[0].LifeDiffBefore(1); ok {
		t.Error("a side without detail has no life totals")
	}
}

func TestPlayerHashesAreReadButNeverShown(t *testing.T) {
	g := byGUID(t, readFixture(t), "g-a")
	if g.Sides[0].Player != "p1hash" || g.Sides[1].Player != "p2hash" {
		t.Fatalf("player1_name belongs to deck1, player2_name to deck2: %q %q", g.Sides[0].Player, g.Sides[1].Player)
	}
	b, err := json.Marshal(g)
	if err != nil {
		t.Fatal(err)
	}
	for _, out := range []string{fmt.Sprintf("%v", g), fmt.Sprintf("%+v", g), fmt.Sprintf("%#v", g), fmt.Sprint(g.Sides[0].Player), string(b)} {
		if strings.Contains(out, "p1hash") || strings.Contains(out, "p2hash") {
			t.Fatalf("a player hash was printed: %s", out)
		}
	}
}

func TestBlindSuffixIsStrippedFromCardIDs(t *testing.T) {
	const csv = `game_guid,game_id,format,deck1_json,deck2_json,created_at,conceded
g,1,1,"{'playerHero': 'viserai_usurper', 'turns': 1, 'character': [{'cardId': 'nebula~BLIND'}], 'cardResults': [{'cardId': 'oaken_old_red~BLIND', 'numCopies': 1}], 'turnLog': [[0, 'oaken_old_red~BLIND', 'M']]}","{'playerHero': 'x'}",2026-10-20 10:00:00,False
`
	games, err := ReadAll(strings.NewReader(csv))
	if err != nil {
		t.Fatal(err)
	}
	s := games[0].Sides[0]
	if s.Character[0] != "nebula" || s.Cards[0].ID != "oaken_old_red" || s.Log[0].Card != "oaken_old_red" {
		t.Fatalf("~BLIND left in: %v %+v %+v", s.Character, s.Cards, s.Log)
	}
}

func TestTurnStatsMarkWhichTurnsWereRecorded(t *testing.T) {
	const csv = `game_guid,game_id,format,deck1_json,deck2_json,created_at,conceded
g,1,1,"{'playerHero': 'viserai_usurper', 'turns': 3, 'cardResults': [], 'turnResults': {'turn_0': {'damageDealt': 0}, 'turn_2': {'damageDealt': 4, 'lifeAtTurnEnd': 30, 'opponentLifeAtTurnEnd': 33}}}","{'playerHero': 'x'}",2026-10-20 10:00:00,False
`
	games, err := ReadAll(strings.NewReader(csv))
	if err != nil {
		t.Fatal(err)
	}
	ts := games[0].Sides[0].TurnStats
	if len(ts) != 3 || !ts[0].Recorded || ts[0].HasLife || ts[1].Recorded || !ts[2].Recorded || !ts[2].HasLife {
		t.Fatalf("recorded turns: %+v", ts)
	}
}

// Engine calibration (docs/engine-calibration.md) compares the engine's
// Runechant damage with arcaneDamageDealt, and keeps damage before blocks.
func TestTurnStatsReadArcaneAndThreatenedDamage(t *testing.T) {
	const csv = `game_guid,game_id,format,deck1_json,deck2_json,created_at,conceded
g,1,1,"{'playerHero': 'viserai_usurper', 'turns': 1, 'cardResults': [], 'turnResults': {'turn_0': {'damageDealt': 6, 'damageThreatened': 10, 'arcaneDamageDealt': 2}}}","{'playerHero': 'x'}",2026-10-20 10:00:00,False
`
	games, err := ReadAll(strings.NewReader(csv))
	if err != nil {
		t.Fatal(err)
	}
	ts := games[0].Sides[0].TurnStats[0]
	if ts.DamageThreatened != 10 || ts.ArcaneDealt != 2 || ts.DamageDealt != 6 {
		t.Fatalf("turn stats: %+v", ts)
	}
}

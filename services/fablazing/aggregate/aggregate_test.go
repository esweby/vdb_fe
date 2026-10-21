package aggregate

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

var rule = game.ConcessionRule{MaxTurns: 2, MaxLife: 20}

func opts() Options { return Options{Date: "2026-10-20", Format: 1, Concession: rule} }

// turns gives a side n recorded turns, each with the given damage and life.
func turns(n, dealt, taken, life, oppLife int) []game.TurnStats {
	ts := make([]game.TurnStats, n)
	for i := range ts {
		ts[i] = game.TurnStats{DamageDealt: dealt, DamageTaken: taken, LifeAtEnd: life, OpponentLifeAtEnd: oppLife, HasLife: true, Recorded: true}
	}
	return ts
}

func viserai(hero, opp, player string, won bool, cards ...game.Card) game.Side {
	return game.Side{
		Hero: hero, Opponent: opp, Player: game.PlayerHash(player), Won: won, Turns: 3, Detailed: true,
		Cards: cards, TurnStats: turns(3, 2, 1, 35, 30),
	}
}

func other(hero, opp, player string, won bool) game.Side {
	return game.Side{Hero: hero, Opponent: opp, Player: game.PlayerHash(player), Won: won, Turns: 3, Detailed: true, TurnStats: turns(3, 1, 2, 30, 35)}
}

func g(guid string, a, b game.Side) game.Game {
	return game.Game{GUID: guid, Format: 1, CreatedAt: "2026-10-20 10:00:00." + guid, Sides: [2]game.Side{a, b}}
}

// abandoned is an early concession at full life.
func abandoned(g game.Game) game.Game {
	g.Conceded = true
	for i := range g.Sides {
		g.Sides[i].Turns = 1
		g.Sides[i].TurnStats = turns(1, 0, 0, 40, 40)
	}
	return g
}

func card(id string, copies, played, pitched, blocked, hits int) game.Card {
	return game.Card{ID: id, Copies: copies, Played: played, Pitched: pitched, Blocked: blocked, Hits: hits}
}

func cardRow(t *testing.T, r Result, id, side string) CardDaily {
	t.Helper()
	for _, c := range r.Cards {
		if c.Card == id && c.SideAtEnd == side {
			return c
		}
	}
	t.Fatalf("no card row for %s on %s in %+v", id, side, r.Cards)
	return CardDaily{}
}

func matchup(t *testing.T, r Result, hero, opp string) MatchupDaily {
	t.Helper()
	for _, m := range r.Matchups {
		if m.Hero == hero && m.Opponent == opp {
			return m
		}
	}
	t.Fatalf("no matchup row for %s v %s in %+v", hero, opp, r.Matchups)
	return MatchupDaily{}
}

func run(t *testing.T, o Options, games ...game.Game) Result {
	t.Helper()
	r, err := Run(games, o)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestCardRowsBySideAtEnd(t *testing.T) {
	r := run(t, opts(),
		g("1", viserai("viserai_usurper", "fang", "a", true, card("bsl_blue", 3, 1, 0, 0, 0), card("dirge_red", 2, 2, 0, 1, 1)), other("fang", "viserai_usurper", "b", false)),
		g("2", viserai("viserai_usurper", "levia", "c", false, card("bsl_blue", 2, 0, 1, 0, 0)), other("levia", "viserai_usurper", "d", true)),
		g("3", viserai("viserai_the_forsaken", "levia", "e", true, card("bsl_blue", 1, 1, 0, 0, 0)), other("levia", "viserai_the_forsaken", "f", false)),
	)
	want := CardDaily{Card: "bsl_blue", SideAtEnd: "viserai_usurper", Decks: 2, Copies: 5, ResultDecks: 2, Played: 1, Pitched: 1, Wins: 1}
	if got := cardRow(t, r, "bsl_blue", "viserai_usurper"); got != want {
		t.Errorf("got %+v, want %+v", got, want)
	}
	want = CardDaily{Card: "dirge_red", SideAtEnd: "viserai_usurper", Decks: 1, Copies: 2, ResultDecks: 1, Played: 2, Blocked: 1, Hits: 1, Wins: 1}
	if got := cardRow(t, r, "dirge_red", "viserai_usurper"); got != want {
		t.Errorf("got %+v, want %+v", got, want)
	}
	if got := cardRow(t, r, "bsl_blue", "viserai_the_forsaken"); got.Decks != 1 || got.Wins != 1 {
		t.Errorf("forsaken row: %+v", got)
	}
	if len(r.Cards) != 3 {
		t.Errorf("only Viserai's cards are counted: %+v", r.Cards)
	}
	if got := r.Run.Decks["viserai_usurper"]; got != (DeckTotals{Decks: 2, ResultDecks: 2, Wins: 1}) {
		t.Errorf("deck totals for inclusion rates: %+v", got)
	}
}

func TestAbandonedGamesCountForInclusionButNotResults(t *testing.T) {
	r := run(t, opts(),
		abandoned(g("1", viserai("viserai_usurper", "fang", "a", true, card("bsl_blue", 3, 1, 0, 0, 0)), other("fang", "viserai_usurper", "b", false))),
	)
	want := CardDaily{Card: "bsl_blue", SideAtEnd: "viserai_usurper", Decks: 1, Copies: 3}
	if got := cardRow(t, r, "bsl_blue", "viserai_usurper"); got != want {
		t.Errorf("got %+v, want %+v", got, want)
	}
	if m := matchup(t, r, "viserai", "fang"); m != (MatchupDaily{Hero: "viserai", Opponent: "fang", Abandoned: 1}) {
		t.Errorf("matchup: %+v", m)
	}
	if len(r.Turns) != 0 || len(r.Traverses) != 0 {
		t.Errorf("abandoned games give no turn or traverse stats: %+v %+v", r.Turns, r.Traverses)
	}
	if r.Run.Games != 1 || r.Run.Abandoned != 1 {
		t.Errorf("run: %+v", r.Run)
	}
}

func TestMatchupsCoverAllGamesWithViseraiAsOneHero(t *testing.T) {
	noDetail := game.Side{Hero: "viserai_the_forsaken", Opponent: "fang", Player: "c", Won: false}
	r := run(t, opts(),
		g("1", viserai("viserai_usurper", "fang", "a", true), other("fang", "viserai_usurper", "b", false)),
		g("2", noDetail, other("fang", "viserai_the_forsaken", "d", true)),
		g("3", other("ira", "levia", "e", true), other("levia", "ira", "f", false)),
		g("4", viserai("viserai_usurper", "viserai_the_forsaken", "g", true), viserai("viserai_the_forsaken", "viserai_usurper", "h", false)),
	)
	for _, tc := range []MatchupDaily{
		{Hero: "viserai", Opponent: "fang", Games: 2, Wins: 1},
		{Hero: "fang", Opponent: "viserai", Games: 2, Wins: 1},
		{Hero: "ira", Opponent: "levia", Games: 1, Wins: 1},
		{Hero: "levia", Opponent: "ira", Games: 1},
		{Hero: "viserai", Opponent: "viserai", Games: 2, Wins: 1},
	} {
		if got := matchup(t, r, tc.Hero, tc.Opponent); got != tc {
			t.Errorf("got %+v, want %+v", got, tc)
		}
	}
	if len(r.Matchups) != 5 {
		t.Errorf("matchups: %+v", r.Matchups)
	}
	if r.Run.Sides != 8 || r.Run.SidesWithoutDetail != 1 || r.Run.ViseraiSides != 4 || r.Run.ViseraiSidesWithoutDetail != 1 {
		t.Errorf("run counts: %+v", r.Run)
	}
	if got := r.Run.Decks["viserai_the_forsaken"]; got.Decks != 1 {
		t.Errorf("a side without detail isn't a deck: %+v", got)
	}
}

func TestSidesWithoutDetailCountForMatchupsOnly(t *testing.T) {
	noDetail := game.Side{Hero: "viserai_usurper", Opponent: "fang", Player: "a", Won: true, Turns: 5}
	r := run(t, opts(), g("1", noDetail, other("fang", "viserai_usurper", "b", false)))
	if len(r.Cards) != 0 || len(r.Turns) != 0 || len(r.Traverses) != 0 {
		t.Errorf("no detail, no card, turn or traverse rows: %+v", r)
	}
	if m := matchup(t, r, "viserai", "fang"); m.Games != 1 || m.Wins != 1 {
		t.Errorf("matchup: %+v", m)
	}
}

func TestTurnRowsForViserai(t *testing.T) {
	a := viserai("viserai_usurper", "fang", "a", true)
	a.TurnStats = []game.TurnStats{
		{DamageDealt: 0, DamageTaken: 3, LifeAtEnd: 37, HasLife: true, Recorded: true},
		{},
		{DamageDealt: 6, Recorded: true},
	}
	b := viserai("viserai_the_forsaken", "levia", "c", false)
	b.TurnStats = []game.TurnStats{{DamageDealt: 2, DamageTaken: 1, LifeAtEnd: 39, HasLife: true, Recorded: true}}
	r := run(t, opts(), g("1", a, other("fang", "viserai_usurper", "b", false)), g("2", b, other("levia", "viserai_the_forsaken", "d", true)))
	want := []TurnDaily{
		{Turn: 0, Sides: 2, DamageDealt: 2, DamageTaken: 4, LifeSides: 2, LifeAtEnd: 76},
		{Turn: 2, Sides: 1, DamageDealt: 6},
	}
	if !reflect.DeepEqual(r.Turns, want) {
		t.Errorf("got %+v, want %+v", r.Turns, want)
	}
}

func TestTraverseRows(t *testing.T) {
	never := viserai("viserai_the_forsaken", "fang", "a", false)
	once := viserai("viserai_usurper", "fang", "c", true)
	once.Log = []game.Event{{Turn: 1, Card: "bsl_blue", Action: "M"}, {Turn: 2, Card: "viserai_usurper", Action: "TRANSFORM"}}
	twice := viserai("viserai_the_forsaken", "fang", "e", true)
	twice.Log = []game.Event{{Turn: 1, Card: "viserai_usurper", Action: "TRANSFORM"}, {Turn: 3, Card: "viserai_the_forsaken", Action: "TRANSFORM"}}
	r := run(t, opts(),
		g("1", never, other("fang", "viserai_the_forsaken", "b", true)),
		g("2", once, other("fang", "viserai_usurper", "d", false)),
		g("3", twice, other("fang", "viserai_the_forsaken", "f", false)),
	)
	want := []TraverseDaily{
		{SideAtEnd: "viserai_the_forsaken", FirstTraverseTurn: -1, Traverses: 0, Sides: 1},
		{SideAtEnd: "viserai_the_forsaken", FirstTraverseTurn: 1, Traverses: 2, Sides: 1, Wins: 1},
		{SideAtEnd: "viserai_usurper", FirstTraverseTurn: 2, Traverses: 1, Sides: 1, Wins: 1},
	}
	if !reflect.DeepEqual(r.Traverses, want) {
		t.Errorf("got %+v, want %+v", r.Traverses, want)
	}
}

func TestOnePlayersWeightIsCapped(t *testing.T) {
	o := opts()
	o.PlayerCap = 2
	var games []game.Game
	for _, guid := range []string{"1", "2", "3"} {
		games = append(games, g(guid, viserai("viserai_usurper", "fang", "grinder", true, card("bsl_blue", 3, 1, 0, 0, 0)), other("fang", "viserai_usurper", "opp"+guid, false)))
	}
	r := run(t, o, games...)
	if got := cardRow(t, r, "bsl_blue", "viserai_usurper"); got.Decks != 2 || got.Wins != 2 {
		t.Errorf("the third game by one player is left out: %+v", got)
	}
	if m := matchup(t, r, "viserai", "fang"); m.Games != 2 {
		t.Errorf("viserai v fang: %+v", m)
	}
	if m := matchup(t, r, "fang", "viserai"); m.Games != 3 {
		t.Errorf("the opponents are different players, so all three count: %+v", m)
	}
	if r.Run.CappedSides != 1 {
		t.Errorf("capped sides: %d", r.Run.CappedSides)
	}
}

func TestTheCapKeepsAPlayersEarliestGames(t *testing.T) {
	o := opts()
	o.PlayerCap = 1
	late := g("2", viserai("viserai_usurper", "fang", "p", false, card("late_red", 1, 0, 0, 0, 0)), other("fang", "viserai_usurper", "x", true))
	early := g("1", viserai("viserai_usurper", "fang", "p", true, card("early_red", 1, 0, 0, 0, 0)), other("fang", "viserai_usurper", "y", false))
	r := run(t, o, late, early)
	if len(r.Cards) != 1 || r.Cards[0].Card != "early_red" {
		t.Errorf("the cap keeps the earliest game by created_at: %+v", r.Cards)
	}
}

func TestSidesWithoutAPlayerHashAreNotCapped(t *testing.T) {
	o := opts()
	o.PlayerCap = 1
	r := run(t, o,
		g("1", viserai("viserai_usurper", "fang", "", true), other("fang", "viserai_usurper", "", false)),
		g("2", viserai("viserai_usurper", "fang", "", true), other("fang", "viserai_usurper", "", false)),
	)
	if m := matchup(t, r, "viserai", "fang"); m.Games != 2 || r.Run.CappedSides != 0 {
		t.Errorf("unknown players aren't one player: %+v %+v", m, r.Run)
	}
}

func TestRunListsCardAndHeroIDsSeen(t *testing.T) {
	r := run(t, opts(),
		g("1", viserai("viserai_usurper", "fang", "a", true, card("dirge_red", 2, 0, 0, 0, 0), card("bsl_blue", 3, 0, 0, 0, 0)), other("fang", "viserai_usurper", "b", false)),
		g("2", viserai("viserai_the_forsaken", "levia", "c", true, card("bsl_blue", 3, 0, 0, 0, 0)), other("levia", "viserai_the_forsaken", "d", false)),
	)
	if want := []string{"bsl_blue", "dirge_red"}; !reflect.DeepEqual(r.Run.CardIDs, want) {
		t.Errorf("card ids: %v", r.Run.CardIDs)
	}
	if want := []string{"fang", "levia", "viserai_the_forsaken", "viserai_usurper"}; !reflect.DeepEqual(r.Run.HeroIDs, want) {
		t.Errorf("hero ids: %v", r.Run.HeroIDs)
	}
	if r.Run.Date != "2026-10-20" || r.Run.Format != 1 {
		t.Errorf("run: %+v", r.Run)
	}
}

func TestGamesFromAnotherFormatAreRefused(t *testing.T) {
	x := g("1", other("ira", "levia", "a", true), other("levia", "ira", "b", false))
	x.Format = 0
	if _, err := Run([]game.Game{x}, opts()); err == nil {
		t.Fatal("a game in format 0 can't go into a format 1 run")
	}
}

func TestOutputHasNoPlayerHashes(t *testing.T) {
	r := run(t, opts(), g("1", viserai("viserai_usurper", "fang", "secret-hash-1", true, card("bsl_blue", 3, 0, 0, 0, 0)), other("fang", "viserai_usurper", "secret-hash-2", false)))
	b, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), "secret-hash") {
		t.Fatalf("player hash in output: %s", b)
	}
}

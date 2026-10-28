package archetypes

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

func opts() Options {
	return Options{MinTurns: 4, Concession: game.ConcessionRule{MaxTurns: 2, MaxLife: 20}, PlayerCap: 20, K: 2, MinShare: 0.02, MinSample: 5, Seed: 1}
}

var core = []string{"become_the_shadow_lord_blue", "malefic_incantation_red", "murmuring_gloomblade_red"}

// deck is a detailed Viserai side, 4 turns long, running three of each card.
func deck(player string, won bool, cards ...string) game.Side {
	s := game.Side{Hero: "viserai_the_forsaken", Opponent: "kano", Player: game.PlayerHash(player), Won: won, Turns: 4, FirstPlayer: 1, Detailed: true}
	for _, c := range append(append([]string(nil), core...), cards...) {
		s.Cards = append(s.Cards, game.Card{ID: c, Copies: 3})
	}
	return s
}

var n int

func g(a game.Side) game.Game {
	n++
	opp := game.Side{Hero: "kano", Opponent: a.Hero, Player: "opp", Turns: a.Turns, Detailed: true}
	return game.Game{GUID: fmt.Sprintf("g%06d", n), CreatedAt: "2026-10-20 10:00:00", Sides: [2]game.Side{a, opp}}
}

// styles is 30 sinchant lists and 20 Widespread lists, each from its own player.
func styles() []game.Game {
	var games []game.Game
	for i := range 30 {
		games = append(games, g(deck(fmt.Sprintf("s%d", i), i < 15, "runechant_of_lust_yellow", "runechant_of_sloth_yellow", "vantom_wraith_red")))
	}
	for i := range 20 {
		games = append(games, g(deck(fmt.Sprintf("w%d", i), i < 5, "widespread_annihilation_blue", "widespread_ruin_red", "deadwood_dirge_red")))
	}
	return games
}

func TestClustersSeparateTwoDeckStyles(t *testing.T) {
	r := Compute(styles(), opts())
	if len(r.Archetypes) != 2 {
		t.Fatalf("archetypes = %d, want 2", len(r.Archetypes))
	}
	a, b := r.Archetypes[0], r.Archetypes[1]
	if a.Sides != 30 || a.Wins != 15 || b.Sides != 20 || b.Wins != 5 {
		t.Fatalf("largest first: got %d/%d and %d/%d", a.Wins, a.Sides, b.Wins, b.Sides)
	}
	if a.Inclusion["runechant_of_lust_yellow"] != 1 || a.Inclusion["widespread_ruin_red"] != 0 || b.Inclusion["widespread_ruin_red"] != 1 {
		t.Fatalf("inclusion: %v / %v", a.Inclusion, b.Inclusion)
	}
	if r.Inclusion["runechant_of_lust_yellow"] != 0.6 || r.Inclusion["become_the_shadow_lord_blue"] != 1 {
		t.Fatalf("overall inclusion: %v", r.Inclusion)
	}
}

func TestComputeIsDeterministic(t *testing.T) {
	if a, b := Compute(styles(), opts()), Compute(styles(), opts()); !reflect.DeepEqual(a, b) {
		t.Fatal("two runs over the same games differ")
	}
}

func TestCoreAndDistinctiveCards(t *testing.T) {
	r := Compute(styles(), opts())
	a := r.Archetypes[0]
	if got, want := a.Core(0.8), []string{"become_the_shadow_lord_blue", "malefic_incantation_red", "murmuring_gloomblade_red", "runechant_of_lust_yellow", "runechant_of_sloth_yellow", "vantom_wraith_red"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("core = %v, want %v", got, want)
	}
	// Distinctive is the cards most over the overall inclusion: the shared core isn't.
	if got, want := a.Distinctive(r.Inclusion, 3), []string{"runechant_of_lust_yellow", "runechant_of_sloth_yellow", "vantom_wraith_red"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("distinctive = %v, want %v", got, want)
	}
}

func TestTalliesByFormatAndWhoWentFirst(t *testing.T) {
	games := styles()
	games[0].Format = 1
	games[1].Sides[0].FirstPlayer = 0
	games[1].Sides[0].Turns = 5 // going second needs a round more, like turntypes
	a := Compute(games, opts()).Archetypes[0]
	if a.ByFormat[1] != (Tally{1, 1}) || a.ByFormat[0] != (Tally{29, 14}) {
		t.Fatalf("by format = %v", a.ByFormat)
	}
	if a.ByFirst["second"] != (Tally{1, 1}) || a.ByFirst["first"] != (Tally{29, 14}) {
		t.Fatalf("by first = %v", a.ByFirst)
	}
}

func TestLiftComparesSidesWithAndWithoutACardInOneArchetype(t *testing.T) {
	games := styles()
	// Half the sinchant lists, the winners, also run Revel in Runeblood.
	for i := range 15 {
		s := &games[i].Sides[0]
		s.Cards = append(s.Cards, game.Card{ID: "revel_in_runeblood_red", Copies: 2})
	}
	a := Compute(games, opts()).Archetypes[0]
	var got *Lift
	for i := range a.Lift {
		if a.Lift[i].Card == "revel_in_runeblood_red" {
			got = &a.Lift[i]
		}
	}
	if got == nil || got.With != (Tally{15, 15}) || got.Without != (Tally{15, 0}) {
		t.Fatalf("lift = %+v", a.Lift)
	}
	for _, l := range a.Lift {
		if l.Card == "runechant_of_lust_yellow" {
			t.Fatal("a card every list runs has no sides without it to compare")
		}
	}
}

func TestOnlyKeptViseraiSidesCount(t *testing.T) {
	games := styles()
	noDetail := deck("x", true)
	noDetail.Detailed = false
	short := deck("y", true)
	short.Turns = 3
	abandoned := g(deck("z", false))
	abandoned.Conceded = true
	abandoned.Sides[0].Turns, abandoned.Sides[1].Turns = 2, 2
	other := deck("o", true)
	other.Hero = "kano"
	games = append(games, g(noDetail), g(short), abandoned, g(other))
	o := opts()
	o.PlayerCap = 1
	games = append(games, g(deck("s0", true, "runechant_of_lust_yellow"))) // s0's second side that day

	r := Compute(games, o)
	if want := (Counts{Games: 55, ViseraiSides: 54, Abandoned: 1, WithoutDetail: 1, Short: 1, Capped: 1, Kept: 50}); r.Counts != want {
		t.Fatalf("counts = %+v, want %+v", r.Counts, want)
	}
}

// A few strong players on one list can make an archetype look good, so each
// archetype counts its distinct players.
func TestArchetypesCountDistinctPlayers(t *testing.T) {
	games := styles()
	for i := range 10 {
		games[i].Sides[0].Player = "same"
		games[i].CreatedAt = fmt.Sprintf("2026-10-%02d 10:00:00", i+1) // under the cap: one a day
	}
	r := Compute(games, opts())
	if a, b := r.Archetypes[0], r.Archetypes[1]; a.Players != 21 || b.Players != 20 {
		t.Fatalf("players = %d and %d, want 21 and 20", a.Players, b.Players)
	}
}

// Lists can include the sideboard, so each archetype says how big its lists are.
func TestArchetypesAverageListSize(t *testing.T) {
	games := styles()
	games[0].Sides[0].Cards = append(games[0].Sides[0].Cards, game.Card{ID: "truce_blue", Copies: 30})
	r := Compute(games, opts())
	if a, b := r.Archetypes[0], r.Archetypes[1]; a.MeanCards != 19 || b.MeanCards != 18 {
		t.Fatalf("mean cards = %v and %v, want 19 and 18", a.MeanCards, b.MeanCards)
	}
}

func set(cards ...string) map[string]bool {
	out := map[string]bool{}
	for _, c := range cards {
		out[c] = true
	}
	return out
}

func TestSimilarityIsSharedCardsOverAllCards(t *testing.T) {
	if got := Similarity(set("a", "b", "c"), set("b", "c", "d")); got != 0.5 {
		t.Fatalf("similarity = %v, want 0.5", got)
	}
	if got := Similarity(set(), set()); got != 0 {
		t.Fatalf("empty similarity = %v", got)
	}
}

func TestNearestPlacesAListInItsArchetype(t *testing.T) {
	r := Compute(styles(), opts())
	sinchants := set(append(core, "runechant_of_lust_yellow", "vantom_wraith_red")...)
	widespread := set(append(core, "widespread_ruin_red", "deadwood_dirge_red", "cull_red")...)
	if got := r.Nearest(sinchants); got != 0 {
		t.Errorf("sinchant list placed in %d, want 0", got)
	}
	if got := r.Nearest(widespread); got != 1 {
		t.Errorf("widespread list placed in %d, want 1", got)
	}
}

func TestLookalikesAreKeptSidesAtLeastThatSimilar(t *testing.T) {
	games := styles()
	games = append(games, g(deck("near", true, "runechant_of_lust_yellow", "runechant_of_sloth_yellow")))
	target := set(append(core, "runechant_of_lust_yellow", "runechant_of_sloth_yellow", "vantom_wraith_red")...)
	sides := Lookalikes(games, target, opts(), 0.8)
	// 30 sinchant lists match exactly; "near" shares 5 of 6 (0.83); Widespread shares 3 of 9.
	if len(sides) != 31 {
		t.Fatalf("lookalikes = %d, want 31", len(sides))
	}
}

// own is a detailed Viserai side going first with damage threatened per own turn.
func own(threatened ...int) game.Side {
	s := deck("p", true)
	s.TurnStats = make([]game.TurnStats, len(threatened))
	for i, d := range threatened {
		s.TurnStats[i] = game.TurnStats{DamageThreatened: d, Recorded: true}
	}
	s.Turns = len(threatened)
	return s
}

func TestProfileTalliesOwnTurnsOneToFour(t *testing.T) {
	a := own(2, 9, 14, 20, 30) // turn 5 is past the window
	a.Log = []game.Event{{Turn: 1, Card: "viserai_usurper", Action: "TRANSFORM"}, {Turn: 3, Card: "usurp_the_shadow_throne_blue", Action: "M"}}
	b := own(0, 4, 18)
	b.Won = false
	c := own(3, 3, 3, 3, 3, 3, 3, 3)
	c.Log = []game.Event{{Turn: 7, Card: "usurp_the_shadow_throne_blue", Action: "M"}} // Usurp counts any time in the game
	c.Won = false
	p := Profile([]game.Side{a, b, c}, ProfileOptions{Rounds: 4, Brick: 5, Big: 14, Peak: 18, Usurp: "usurp_the_shadow_throne_blue"})
	want := ProfileTally{Sides: 3, Wins: 1, Turns: 11, Threatened: 2 + 9 + 14 + 20 + 0 + 4 + 18 + 12, Bricks: 7, Big: 3, Flips: 1, PeakSides: 2, UsurpSides: 2, UsurpWins: 1,
		FlipSides: 1, GameTurns: 5 + 3 + 8, GameFlips: 1, UsurperTurns: 3}
	if p != want {
		t.Fatalf("profile = %+v, want %+v", p, want)
	}
}

func TestEachArchetypeHasATurnProfile(t *testing.T) {
	o := opts()
	o.Profile = ProfileOptions{Rounds: 4, Brick: 5, Big: 14, Peak: 18}
	r := Compute(styles(), o)
	if a := r.Archetypes[0]; a.Turns.Sides != a.Sides || a.Turns.Wins != a.Wins {
		t.Fatalf("profile = %+v for %d sides", a.Turns, a.Sides)
	}
}

// Flips and returns: by own turn 4, and over the whole game how many own
// turns began as the Usurper, to compare with how many flips there were.
func TestProfileCountsFlipsReturnsAndTurnsAsTheUsurper(t *testing.T) {
	d := own(5, 5, 5, 5, 5)
	d.Log = []game.Event{
		{Turn: 0, Card: "viserai_usurper", Action: "TRANSFORM"},
		{Turn: 1, Card: "viserai_the_forsaken", Action: "TRANSFORM"},
		{Turn: 2, Card: "viserai_usurper", Action: "TRANSFORM"},
	}
	p := Profile([]game.Side{d}, ProfileOptions{Rounds: 4, Brick: 5, Big: 14, Peak: 18})
	// Own turns 2, 4 and 5 begin as the Usurper; turn 3 begins back as the Forsaken.
	got := [7]int{p.Flips, p.Backs, p.FlipSides, p.BackSides, p.GameFlips, p.GameBacks, p.UsurperTurns}
	if want := [7]int{2, 1, 1, 1, 2, 1, 3}; got != want {
		t.Fatalf("flips, backs, flip sides, back sides, game flips, game backs, Usurper turns = %v, want %v", got, want)
	}
}

func TestCopiesCountsACardInAList(t *testing.T) {
	s := deck("p", true, "usurp_the_shadow_throne_blue")
	if got := Copies(s, "usurp_the_shadow_throne_blue"); got != 3 {
		t.Fatalf("copies = %d, want 3", got)
	}
	if got := Copies(s, "revel_in_runeblood_red"); got != 0 {
		t.Fatalf("copies = %d, want 0", got)
	}
}

// One busy winner shouldn't carry a group: each player's own win rate counts once.
func TestByPlayerWeighsEachPlayerEqually(t *testing.T) {
	var sides []game.Side
	for range 8 {
		sides = append(sides, deck("busy", true))
	}
	sides = append(sides, deck("a", false), deck("b", false), deck("c", true), deck("c", false))
	w := ByPlayer(sides, 200, 1)
	// busy 1, a 0, b 0, c 0.5: a mean of 0.375, against 9 wins in 12 sides.
	if w.Players != 4 || w.Rate != 0.375 {
		t.Fatalf("players %d, rate %v; want 4 and 0.375", w.Players, w.Rate)
	}
	if !(w.Low <= w.Rate && w.Rate <= w.High && w.Low < w.High) {
		t.Fatalf("interval [%v, %v] should hold %v", w.Low, w.High, w.Rate)
	}
	// The busiest player's share of the sides.
	if w.TopShare != 8.0/12 || w.TopRate != 1 || w.RestRate != 0.25 {
		t.Fatalf("top share %v, top rate %v, the rest by side %v", w.TopShare, w.TopRate, w.RestRate)
	}
	if again := ByPlayer(sides, 200, 1); again != w {
		t.Fatal("the same seed should give the same interval")
	}
}

// Package aggregate turns one date and format of FaBlazing games into the
// daily rows of step 3 of docs/fablazing-plan.md. It's pure: it doesn't read
// files or write to a database. The rows are associations, not causes.
//
// The rules:
//   - Abandoned early concessions are left out of results (wins, plays, turn
//     and traverse stats) but kept for decklists and inclusion.
//   - Sides without detail count for matchups only.
//   - One player's weight is capped: past Options.PlayerCap sides in a run,
//     a player's later sides (by created_at) are left out of every row.
//   - Viserai is one hero: matchups use "viserai", and card, traverse and deck
//     rows are split by the side Viserai ended the game on.
package aggregate

import (
	"fmt"
	"sort"

	"github.com/esweby/vdb_fe/services/fablazing/game"
)

// Viserai is the hero id matchups use for either side of Viserai.
const Viserai = "viserai"

// PlayerCap is the most sides one player contributes to a day and format:
// their earliest games by created_at. Set by the maintainer on 21 Oct 2026;
// recheck once there's a month of data (does Classic Constructed play drop
// after game 20?).
const PlayerCap = 20

// Concession is the rule for an abandoned early concession, accepted
// provisionally by the maintainer on 21 Oct 2026.
var Concession = game.ConcessionRule{MaxTurns: 2, MaxLife: 20}

// Options for one run.
type Options struct {
	Date       string // YYYY-MM-DD, carried into Run
	Format     int    // every game must be in this format
	Concession game.ConcessionRule
	// PlayerCap is the most sides one player contributes to a run. 0 means
	// no cap. Sides without a player hash aren't capped.
	PlayerCap int
}

// Result is every row for one date and format.
type Result struct {
	Run       Summary         `json:"run"`
	Cards     []CardDaily     `json:"cards"`
	Matchups  []MatchupDaily  `json:"matchups"`
	Turns     []TurnDaily     `json:"turns"`
	Traverses []TraverseDaily `json:"traverses"`
}

// Summary summarises the run, for fablazing_runs.
type Summary struct {
	Date                      string `json:"date"`
	Format                    int    `json:"format"`
	Games                     int    `json:"games"`
	Abandoned                 int    `json:"abandoned"` // games that were abandoned early concessions
	Sides                     int    `json:"sides"`
	SidesWithoutDetail        int    `json:"sides_without_detail"`
	ViseraiSides              int    `json:"viserai_sides"`
	ViseraiSidesWithoutDetail int    `json:"viserai_sides_without_detail"`
	CappedSides               int    `json:"capped_sides"` // left out by the player cap
	// Decks is Viserai's detailed sides by side at end: the denominators for
	// card inclusion and win rates.
	Decks   map[string]DeckTotals `json:"decks"`
	CardIDs []string              `json:"card_ids"` // every card id in Cards, for mapping slugs
	HeroIDs []string              `json:"hero_ids"` // every hero id in the counted sides, as written
}

// DeckTotals counts Viserai's detailed sides on one side at end.
type DeckTotals struct {
	Decks       int `json:"decks"`        // including abandoned games
	ResultDecks int `json:"result_decks"` // games that count as results
	Wins        int `json:"wins"`
}

// CardDaily is one card in Viserai's decks, by the side Viserai ended on.
type CardDaily struct {
	Card      string `json:"card"`
	SideAtEnd string `json:"side_at_end"`
	// Decks and Copies include abandoned games.
	Decks  int `json:"decks"`
	Copies int `json:"copies"`
	// The rest count only games that are results.
	ResultDecks int `json:"result_decks"`
	Played      int `json:"played"`
	Pitched     int `json:"pitched"`
	Blocked     int `json:"blocked"`
	Hits        int `json:"hits"`
	Wins        int `json:"wins"` // result decks that won
}

// MatchupDaily is one hero against one opponent, from the hero's side. Every
// game gives two rows, one from each side.
type MatchupDaily struct {
	Hero      string `json:"hero"`
	Opponent  string `json:"opponent"`
	Games     int    `json:"games"` // games that count as results
	Wins      int    `json:"wins"`
	Abandoned int    `json:"abandoned"`
}

// TurnDaily is Viserai's turn stats for one turn index (a round).
type TurnDaily struct {
	Turn        int `json:"turn"`
	Sides       int `json:"sides"` // sides with the turn recorded
	DamageDealt int `json:"damage_dealt"`
	DamageTaken int `json:"damage_taken"`
	LifeSides   int `json:"life_sides"`  // sides with a life total for the turn
	LifeAtEnd   int `json:"life_at_end"` // sum over LifeSides
}

// TraverseDaily counts Viserai's sides by traverse pattern.
type TraverseDaily struct {
	SideAtEnd         string `json:"side_at_end"`
	FirstTraverseTurn int    `json:"first_traverse_turn"` // -1 when Viserai never traversed
	Traverses         int    `json:"traverses"`
	Sides             int    `json:"sides"`
	Wins              int    `json:"wins"`
}

type cardKey struct{ card, side string }
type matchupKey struct{ hero, opp string }
type traverseKey struct {
	side         string
	first, count int
}

// Run aggregates games from one date and format. Games may come in any order;
// the player cap keeps each player's earliest sides by created_at.
func Run(games []game.Game, o Options) (Result, error) {
	ordered, kept := Counted(games, o.PlayerCap)

	run := Summary{Date: o.Date, Format: o.Format, Decks: map[string]DeckTotals{}}
	cards := map[cardKey]*CardDaily{}
	matchups := map[matchupKey]*MatchupDaily{}
	turns := map[int]*TurnDaily{}
	traverses := map[traverseKey]*TraverseDaily{}
	heroes := map[string]bool{}

	for gi, g := range ordered {
		if g.Format != o.Format {
			return Result{}, fmt.Errorf("game %s is format %d, not %d", g.GUID, g.Format, o.Format)
		}
		run.Games++
		abandoned := g.Abandoned(o.Concession)
		if abandoned {
			run.Abandoned++
		}
		for si, s := range g.Sides {
			run.Sides++
			isViserai := game.IsViserai(s.Hero)
			if isViserai {
				run.ViseraiSides++
			}
			if !s.Detailed {
				run.SidesWithoutDetail++
				if isViserai {
					run.ViseraiSidesWithoutDetail++
				}
			}
			if !kept[gi][si] {
				run.CappedSides++
				continue
			}
			heroes[s.Hero], heroes[s.Opponent] = true, true

			mk := matchupKey{matchupHero(s.Hero), matchupHero(s.Opponent)}
			m := matchups[mk]
			if m == nil {
				m = &MatchupDaily{Hero: mk.hero, Opponent: mk.opp}
				matchups[mk] = m
			}
			switch {
			case abandoned:
				m.Abandoned++
			case s.Won:
				m.Games++
				m.Wins++
			default:
				m.Games++
			}

			if !isViserai || !s.Detailed {
				continue
			}
			d := run.Decks[s.Hero]
			d.Decks++
			if !abandoned {
				d.ResultDecks++
				if s.Won {
					d.Wins++
				}
			}
			run.Decks[s.Hero] = d

			for _, c := range s.Cards {
				k := cardKey{c.ID, s.Hero}
				row := cards[k]
				if row == nil {
					row = &CardDaily{Card: c.ID, SideAtEnd: s.Hero}
					cards[k] = row
				}
				row.Decks++
				row.Copies += c.Copies
				if abandoned {
					continue
				}
				row.ResultDecks++
				row.Played += c.Played
				row.Pitched += c.Pitched
				row.Blocked += c.Blocked
				row.Hits += c.Hits
				if s.Won {
					row.Wins++
				}
			}
			if abandoned {
				continue
			}

			for i, t := range s.TurnStats {
				if !t.Recorded {
					continue
				}
				row := turns[i]
				if row == nil {
					row = &TurnDaily{Turn: i}
					turns[i] = row
				}
				row.Sides++
				row.DamageDealt += t.DamageDealt
				row.DamageTaken += t.DamageTaken
				if t.HasLife {
					row.LifeSides++
					row.LifeAtEnd += t.LifeAtEnd
				}
			}

			tk := traverseKey{side: s.Hero, first: -1}
			for _, e := range s.Log {
				if e.Action != "TRANSFORM" {
					continue
				}
				if tk.count == 0 {
					tk.first = e.Turn
				}
				tk.count++
			}
			tr := traverses[tk]
			if tr == nil {
				tr = &TraverseDaily{SideAtEnd: tk.side, FirstTraverseTurn: tk.first, Traverses: tk.count}
				traverses[tk] = tr
			}
			tr.Sides++
			if s.Won {
				tr.Wins++
			}
		}
	}

	// Empty lists are [] in JSON, not null: fablazing_replace_day reads each one.
	r := Result{Run: run, Cards: []CardDaily{}, Matchups: []MatchupDaily{}, Turns: []TurnDaily{}, Traverses: []TraverseDaily{}}
	seen := map[string]bool{}
	for _, c := range cards {
		r.Cards = append(r.Cards, *c)
		seen[c.Card] = true
	}
	sort.Slice(r.Cards, func(i, j int) bool {
		a, b := r.Cards[i], r.Cards[j]
		return a.Card < b.Card || (a.Card == b.Card && a.SideAtEnd < b.SideAtEnd)
	})
	r.Run.CardIDs = sortedKeys(seen)
	r.Run.HeroIDs = sortedKeys(heroes)
	for _, m := range matchups {
		r.Matchups = append(r.Matchups, *m)
	}
	sort.Slice(r.Matchups, func(i, j int) bool {
		a, b := r.Matchups[i], r.Matchups[j]
		return a.Hero < b.Hero || (a.Hero == b.Hero && a.Opponent < b.Opponent)
	})
	for _, t := range turns {
		r.Turns = append(r.Turns, *t)
	}
	sort.Slice(r.Turns, func(i, j int) bool { return r.Turns[i].Turn < r.Turns[j].Turn })
	for _, t := range traverses {
		r.Traverses = append(r.Traverses, *t)
	}
	sort.Slice(r.Traverses, func(i, j int) bool {
		a, b := r.Traverses[i], r.Traverses[j]
		if a.SideAtEnd != b.SideAtEnd {
			return a.SideAtEnd < b.SideAtEnd
		}
		if a.FirstTraverseTurn != b.FirstTraverseTurn {
			return a.FirstTraverseTurn < b.FirstTraverseTurn
		}
		return a.Traverses < b.Traverses
	})
	return r, nil
}

// Counted applies the player cap: it orders games by created_at, then GUID,
// and kept[i][j] reports whether side j of ordered[i] counts. Every side with
// a player hash counts toward that player's cap, whatever its hero, detail or
// result, so a player's earliest limit sides are kept. 0 means no cap.
func Counted(games []game.Game, limit int) (ordered []game.Game, kept [][2]bool) {
	ordered = append([]game.Game(nil), games...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i].CreatedAt != ordered[j].CreatedAt {
			return ordered[i].CreatedAt < ordered[j].CreatedAt
		}
		return ordered[i].GUID < ordered[j].GUID
	})
	kept = make([][2]bool, len(ordered))
	perPlayer := map[game.PlayerHash]int{}
	for i, g := range ordered {
		for j, s := range g.Sides {
			kept[i][j] = true
			if s.Player != "" {
				perPlayer[s.Player]++
				kept[i][j] = limit <= 0 || perPlayer[s.Player] <= limit
			}
		}
	}
	return ordered, kept
}

func matchupHero(hero string) string {
	if game.IsViserai(hero) {
		return Viserai
	}
	return hero
}

func sortedKeys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		if k != "" {
			out = append(out, k)
		}
	}
	sort.Strings(out)
	return out
}

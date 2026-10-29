// Command fablazing inspects FaBlazing CSVs locally.
//
//	fablazing game  <file.csv> [guid]                     print a Viserai game turn by turn
//	fablazing chain [-cap n] <spec.json> <sets.json> <file.csv>... measure one chain across Viserai sides
//	fablazing aggregate [-json] [-cap n] <file.csv>        the daily rows for one date and format
//	fablazing turns [-cap n] [-rounds n] [-burst n] [-defend n] <file.csv>... turn types by round (UNVERIFIED)
//
// It prints counts and card ids only: never player hashes or anything secret.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/esweby/vdb_fe/services/fablazing/aggregate"
	"github.com/esweby/vdb_fe/services/fablazing/chain"
	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/measure"
)

// top lists the n most common keys as "key:count".
func top(m map[string]int, n int) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return m[keys[i]] > m[keys[j]] || (m[keys[i]] == m[keys[j]] && keys[i] < keys[j]) })
	if len(keys) > n {
		keys = keys[:n]
	}
	out := make([]string, len(keys))
	for i, k := range keys {
		out[i] = fmt.Sprintf("%s:%d", k, m[k])
	}
	return out
}

var concession = aggregate.Concession

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "usage: fablazing game <file.csv> [guid] | fablazing chain [-cap n] <spec.json> <sets.json> <file.csv>... | fablazing aggregate [-json] [-cap n] <file.csv> | fablazing turns [flags] <file.csv>... | fablazing decks [flags] <file.csv>... | fablazing like [flags] <list.txt> <file.csv>... | fablazing ceiling [flags] <file.csv>...")
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "game":
		err = printGame(os.Args[2], os.Args[3:])
	case "chain":
		err = runChain(os.Args[2:])
	case "aggregate":
		err = runAggregate(os.Args[2:])
	case "turns":
		err = runTurns(os.Args[2:])
	case "decks":
		err = runDecks(os.Args[2:])
	case "like":
		err = runLike(os.Args[2:])
	case "ceiling":
		err = runCeiling(os.Args[2:])
	default:
		err = fmt.Errorf("unknown command %q", os.Args[1])
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "fablazing:", err)
		os.Exit(1)
	}
}

func read(path string) ([]game.Game, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return game.ReadAll(f)
}

// printGame prints the first detailed Viserai side of at least 5 turns, or the given game.
func printGame(path string, args []string) error {
	games, err := read(path)
	if err != nil {
		return err
	}
	for _, g := range games {
		if len(args) > 0 && g.GUID != args[0] {
			continue
		}
		for _, s := range g.Sides {
			if !game.IsViserai(s.Hero) || !s.Detailed || (len(args) == 0 && s.Turns < 5) {
				continue
			}
			result := "lost"
			if s.Won {
				result = "won"
			}
			fmt.Printf("%s v %s: %s in %d turns (ended as %s, format %d, conceded %v)\n", "viserai", s.Opponent, result, s.Turns, s.Hero, g.Format, g.Conceded)
			turn := -1
			var line []string
			flush := func() {
				if turn >= 0 {
					life := ""
					if turn < len(s.TurnStats) && s.TurnStats[turn].HasLife {
						t := s.TurnStats[turn]
						life = fmt.Sprintf("  [dealt %d, life %d v %d]", t.DamageDealt, t.LifeAtEnd, t.OpponentLifeAtEnd)
					}
					fmt.Printf("Turn %d: %s.%s\n", turn, strings.Join(line, ". "), life)
				}
			}
			for _, e := range s.Log {
				if e.Turn != turn {
					flush()
					turn, line = e.Turn, nil
				}
				line = append(line, describe(e))
			}
			flush()
			return nil
		}
	}
	return fmt.Errorf("no matching Viserai game")
}

var verbs = map[string]string{
	"M": "Played", "B": "Blocked with", "P": "Pitched", "HIT": "Hit with", "A": "Activated",
	"D": "Defence reaction", "INSTANT": "Instant", "DISCARD": "Discarded", "PASSIVE": "Passive",
	"CHARGE": "Charged", "TRANSFORM": "Transformed to",
}

// describe uses our reading of each action code, which FaBlazing hasn't confirmed.
func describe(e game.Event) string {
	v, ok := verbs[e.Action]
	if !ok {
		v = e.Action
	}
	return v + " " + e.Card
}

func runChain(args []string) error {
	fs := flag.NewFlagSet("chain", flag.ContinueOnError)
	capN := fs.Int("cap", playerCap, "most sides one player contributes to each CSV, one date and format (0 for no cap)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() < 3 {
		return fmt.Errorf("chain needs a spec, a sets file and at least one CSV")
	}
	return measureChain(fs.Arg(0), fs.Arg(1), fs.Args()[2:], *capN)
}

// sideCounts counts the detailed Viserai sides a chain run leaves out.
type sideCounts struct {
	abandoned int // in abandoned early concessions
	capped    int // past the player cap
}

// chainSides calls fn for each detailed Viserai side that counts as a result,
// applying the player cap as aggregate.Run does for one date and format.
func chainSides(games []game.Game, capN int, fn func(game.Game, game.Side)) sideCounts {
	var c sideCounts
	ordered, kept := aggregate.Counted(games, capN)
	for i, g := range ordered {
		abandoned := g.Abandoned(concession)
		for j, s := range g.Sides {
			if !game.IsViserai(s.Hero) || !s.Detailed {
				continue
			}
			switch {
			case !kept[i][j]:
				c.capped++
			case abandoned:
				c.abandoned++
			default:
				fn(g, s)
			}
		}
	}
	return c
}

func measureChain(specPath, setsPath string, csvs []string, capN int) error {
	var raw map[string][]string
	b, err := os.ReadFile(setsPath)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return fmt.Errorf("sets: %w", err)
	}
	sets := chain.Sets{}
	for name, ids := range raw {
		sets[name] = map[string]bool{}
		for _, id := range ids {
			sets[name][id] = true
		}
	}
	f, err := os.Open(specPath)
	if err != nil {
		return err
	}
	spec, err := chain.ParseSpec(f, sets)
	f.Close()
	if err != nil {
		return err
	}
	if !spec.Registered() {
		return fmt.Errorf("chain %q has no expectation yet: write down what it should do before measuring it", spec.ID)
	}

	sides, abandoned, capped := 0, 0, 0
	reached := make([]int, len(spec.Steps)+1)
	wins := make([]int, len(spec.Steps)+1)
	gap := map[int]int{} // turns from setup to payoff
	var setupTurns []int
	payoffs, sameTurnPayoffs := map[string]int{}, map[string]int{}
	var outcomes []measure.Outcome
	noLife := 0
	for _, path := range csvs {
		games, err := read(path)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		c := chainSides(games, capN, func(g game.Game, s game.Side) {
			sides++
			r := spec.Match(s.Log)
			reached[r.Reached]++
			if s.Won {
				wins[r.Reached]++
			}
			if r.Complete(spec) {
				gap[r.PayoffTurn-r.SetupTurn]++
				setupTurns = append(setupTurns, r.SetupTurn)
				payoffs[r.PayoffCard]++
				if r.PayoffTurn == r.SetupTurn {
					sameTurnPayoffs[r.PayoffCard]++
				}
			}
			if !spec.Compared(r) {
				return
			}
			diff, ok := s.LifeDiffBefore(r.SetupTurn)
			if !ok {
				noLife++
				return
			}
			group := "setup"
			if spec.Paid(r) {
				group = "complete"
			}
			damage := 0
			if r.SetupTurn < len(s.TurnStats) {
				damage = s.TurnStats[r.SetupTurn].DamageDealt
			}
			outcomes = append(outcomes, measure.Outcome{Group: group, Bucket: measure.LifeBucket(diff), Won: s.Won, Damage: damage})
		})
		abandoned += c.abandoned
		capped += c.capped
	}

	fmt.Printf("chain %s (%s)\nexpectation: %s\n", spec.ID, spec.Status, spec.Expectation)
	fmt.Printf("detailed Viserai sides: %d (abandoned early concessions left out: %d; player cap %d per file, left out: %d)\n", sides, abandoned, capN, capped)
	fmt.Println("furthest step reached  sides   share  Viserai won   (association, not cause)")
	for i := range reached {
		name := "none"
		if i > 0 {
			name = spec.Steps[i-1].Name
		}
		share, rate := 0.0, 0.0
		if sides > 0 {
			share = float64(reached[i]) / float64(sides)
		}
		if reached[i] > 0 {
			rate = float64(wins[i]) / float64(reached[i])
		}
		fmt.Printf("  %d %-18s %6d  %5.1f%%  %5.1f%%\n", i, name, reached[i], 100*share, 100*rate)
	}
	keys := make([]int, 0, len(gap))
	for k := range gap {
		keys = append(keys, k)
	}
	sort.Ints(keys)
	fmt.Print("turns from setup to payoff (completed):")
	for _, k := range keys {
		fmt.Printf(" %d:%d", k, gap[k])
	}
	fmt.Printf("\nmedian setup turn (completed): %.1f\n", measure.Median(setupTurns))
	fmt.Println("payoff cards (completed):", top(payoffs, 6))
	fmt.Println("payoff cards (same-turn completions):", top(sameTurnPayoffs, 6))

	c := measure.Compare(outcomes, "complete", "setup")
	if spec.CompareFrom != "" {
		fmt.Printf("\ncompared from step %q: \"completed\" below means reached that step", spec.CompareFrom)
	}
	if spec.CompareBase != "" {
		fmt.Printf("\ncompared among sides that reached step %q: \"setup only\" below means reached it but not the paid step", spec.CompareBase)
	}
	fmt.Printf("\ncompleted v setup without payoff, life totals held level (sides without life data left out: %d)\n", noLife)
	fmt.Printf("  raw win rate:   completed %.1f%% (n=%d)  v  setup only %.1f%% (n=%d)\n", 100*c.RawA, c.NA, 100*c.RawB, c.NB)
	fmt.Printf("  adjusted difference: %+.1f points, 95%% margin ±%.1f (over %d sides in buckets with both groups)\n", 100*c.Adjusted, 100*c.Margin, c.Compared)
	fmt.Printf("  damage dealt on the setup turn: completed %.1f  v  setup only %.1f\n", c.DamageA, c.DamageB)
	fmt.Println("  life going into the setup turn   completed (won/n)   setup only (won/n)")
	for _, b := range measure.Buckets {
		t := c.PerBucket[b]
		fmt.Printf("    %-12s %20s %20s\n", b, fmt.Sprintf("%d/%d", t[0].Wins, t[0].N), fmt.Sprintf("%d/%d", t[1].Wins, t[1].N))
	}
	return nil
}

const playerCap = aggregate.PlayerCap

// minSample is the fewest games before a figure is shown (the plan's guardrail).
const minSample = 50

func runAggregate(args []string) error {
	fs := flag.NewFlagSet("aggregate", flag.ContinueOnError)
	asJSON := fs.Bool("json", false, "write every row as JSON instead of a summary")
	capN := fs.Int("cap", playerCap, "most sides one player contributes (0 for no cap)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() != 1 {
		return fmt.Errorf("aggregate needs one CSV (one date and format)")
	}
	games, err := read(fs.Arg(0))
	if err != nil {
		return err
	}
	if len(games) == 0 {
		return fmt.Errorf("no games in %s", fs.Arg(0))
	}
	date := games[0].CreatedAt
	if len(date) > 10 {
		date = date[:10]
	}
	r, err := aggregate.Run(games, aggregate.Options{Date: date, Format: games[0].Format, Concession: concession, PlayerCap: *capN})
	if err != nil {
		return err
	}
	if *asJSON {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(r)
	}
	printAggregate(r)
	return nil
}

// rate prints k of n with its 95% Wilson interval, or "n<50" below the minimum sample.
func rate(k, n int) string {
	if n < minSample {
		return fmt.Sprintf("(n=%d, under %d)", n, minSample)
	}
	lo, hi := measure.Wilson(k, n)
	return fmt.Sprintf("%5.1f%% [%4.1f-%4.1f] n=%d", 100*float64(k)/float64(n), 100*lo, 100*hi, n)
}

func printAggregate(r aggregate.Result) {
	s := r.Run
	fmt.Printf("%s format %d: %d games (%d abandoned early concessions), %d sides (%d without detail), %d left out by the player cap\n",
		s.Date, s.Format, s.Games, s.Abandoned, s.Sides, s.SidesWithoutDetail, s.CappedSides)
	fmt.Printf("Viserai: %d sides (%d without detail); %d card ids, %d hero ids seen\n", s.ViseraiSides, s.ViseraiSidesWithoutDetail, len(s.CardIDs), len(s.HeroIDs))
	fmt.Println("(associations, not causes)")

	fmt.Println("\ndecks by side at end      decks  won (result decks)")
	for _, side := range sortedSides(s.Decks) {
		d := s.Decks[side]
		fmt.Printf("  %-22s %6d  %s\n", side, d.Decks, rate(d.Wins, d.ResultDecks))
	}

	fmt.Println("\nViserai matchups (results only)        won")
	var ms []aggregate.MatchupDaily
	for _, m := range r.Matchups {
		if m.Hero == aggregate.Viserai {
			ms = append(ms, m)
		}
	}
	sort.Slice(ms, func(i, j int) bool {
		return ms[i].Games > ms[j].Games || (ms[i].Games == ms[j].Games && ms[i].Opponent < ms[j].Opponent)
	})
	for i, m := range ms {
		if i == 12 {
			fmt.Printf("  … and %d more\n", len(ms)-i)
			break
		}
		fmt.Printf("  %-36s %s  (abandoned %d)\n", m.Opponent, rate(m.Wins, m.Games), m.Abandoned)
	}

	for _, side := range sortedSides(s.Decks) {
		total := s.Decks[side]
		var cs []aggregate.CardDaily
		for _, c := range r.Cards {
			if c.SideAtEnd == side {
				cs = append(cs, c)
			}
		}
		sort.Slice(cs, func(i, j int) bool {
			return cs[i].Decks > cs[j].Decks || (cs[i].Decks == cs[j].Decks && cs[i].Card < cs[j].Card)
		})
		fmt.Printf("\ncards ending as %s (%d decks): top by inclusion\n", side, total.Decks)
		fmt.Println("  card                              in decks  copies/deck  played/game  won when included")
		for i, c := range cs {
			if i == 15 {
				break
			}
			perGame := 0.0
			if c.ResultDecks > 0 {
				perGame = float64(c.Played) / float64(c.ResultDecks)
			}
			fmt.Printf("  %-34s %5.1f%%  %11.2f  %11.2f  %s\n", c.Card, 100*float64(c.Decks)/float64(total.Decks),
				float64(c.Copies)/float64(c.Decks), perGame, rate(c.Wins, c.ResultDecks))
		}
	}

	fmt.Println("\nViserai by turn index   sides  dealt/side  taken/side  life at end")
	for _, t := range r.Turns {
		life := "-"
		if t.LifeSides > 0 {
			life = fmt.Sprintf("%.1f", float64(t.LifeAtEnd)/float64(t.LifeSides))
		}
		fmt.Printf("  %-20d %6d  %10.2f  %10.2f  %11s\n", t.Turn, t.Sides, float64(t.DamageDealt)/float64(t.Sides), float64(t.DamageTaken)/float64(t.Sides), life)
	}

	fmt.Println("\ntraverses: side at end, first traverse turn, count     won")
	for _, t := range r.Traverses {
		first := "never"
		if t.FirstTraverseTurn >= 0 {
			first = fmt.Sprintf("turn %d", t.FirstTraverseTurn)
		}
		fmt.Printf("  %-22s %-8s x%-3d %s\n", t.SideAtEnd, first, t.Traverses, rate(t.Wins, t.Sides))
	}
}

func sortedSides(m map[string]aggregate.DeckTotals) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// Command fablazing inspects FaBlazing CSVs locally.
//
//	fablazing game  <file.csv> [guid]                     print a Viserai game turn by turn
//	fablazing chain <spec.json> <sets.json> <file.csv>... measure one chain across Viserai sides
//
// It prints counts and card ids only: never player hashes or anything secret.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

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

var concession = game.ConcessionRule{MaxTurns: 2, MaxLife: 20} // accepted provisionally by the maintainer, 21 Oct 2026

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "usage: fablazing game <file.csv> [guid] | fablazing chain <spec.json> <sets.json> <file.csv>...")
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "game":
		err = printGame(os.Args[2], os.Args[3:])
	case "chain":
		if len(os.Args) < 5 {
			err = fmt.Errorf("chain needs a spec, a sets file and at least one CSV")
		} else {
			err = measureChain(os.Args[2], os.Args[3], os.Args[4:])
		}
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

func measureChain(specPath, setsPath string, csvs []string) error {
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

	sides, abandoned := 0, 0
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
		for _, g := range games {
			if g.Abandoned(concession) {
				for _, s := range g.Sides {
					if game.IsViserai(s.Hero) && s.Detailed {
						abandoned++
					}
				}
				continue
			}
			for _, s := range g.Sides {
				if !game.IsViserai(s.Hero) || !s.Detailed {
					continue
				}
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
				if r.Reached == 0 {
					continue
				}
				diff, ok := s.LifeDiffBefore(r.SetupTurn)
				if !ok {
					noLife++
					continue
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
			}
		}
	}

	fmt.Printf("chain %s (%s)\nexpectation: %s\n", spec.ID, spec.Status, spec.Expectation)
	fmt.Printf("detailed Viserai sides: %d (abandoned early concessions left out: %d)\n", sides, abandoned)
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

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
)

var concession = game.ConcessionRule{MaxTurns: 2, MaxLife: 20} // proposal, for the maintainer to confirm

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
			err = measure(os.Args[2], os.Args[3], os.Args[4:])
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

func measure(specPath, setsPath string, csvs []string) error {
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
				}
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
	fmt.Println()
	return nil
}

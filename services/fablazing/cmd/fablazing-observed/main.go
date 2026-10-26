// Command fablazing-observed writes the observed side of the engine
// calibration (docs/engine-calibration.md) as JSON: per turn index, the
// distributions of Viserai's arcane damage, damage dealt and damage
// threatened, and the turn index of the first traverse to the Usurper.
//
//	fablazing-observed [-min-turns 4] [-cap 20] [-turns 8] [-out file.json] daily.csv...
//
// Each CSV is one FaBlazing daily file (one date and format). Logs show
// associations, not causes.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/esweby/vdb_fe/services/fablazing/aggregate"
	"github.com/esweby/vdb_fe/services/fablazing/game"
	"github.com/esweby/vdb_fe/services/fablazing/observed"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "fablazing-observed:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	fs := flag.NewFlagSet("fablazing-observed", flag.ContinueOnError)
	minTurns := fs.Int("min-turns", 4, "fewest turn indexes a game needs")
	capN := fs.Int("cap", aggregate.PlayerCap, "most sides one player contributes per day and format (0 for no cap)")
	turns := fs.Int("turns", 8, "turn indexes to report, from 0")
	out := fs.String("out", "", "write JSON here instead of standard output")
	chainSpec := fs.String("chain-spec", "", "measure T5 using this bsl-gate-blood-debt spec (requires -chain-sets)")
	chainSets := fs.String("chain-sets", "", "card sets for T5 (requires -chain-spec)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() == 0 {
		return fmt.Errorf("no CSV files given")
	}
	if (*chainSpec == "") != (*chainSets == "") {
		return fmt.Errorf("-chain-spec and -chain-sets must be supplied together")
	}
	options := observed.Options{MinTurns: *minTurns, Concession: aggregate.Concession, PlayerCap: *capN, TurnIndexes: *turns}
	metadata := map[string]any{"min_turns": *minTurns, "player_cap": *capN, "turn_indexes": *turns}
	if *chainSpec != "" {
		specFile, err := os.Open(*chainSpec)
		if err != nil {
			return err
		}
		defer specFile.Close()
		setsFile, err := os.Open(*chainSets)
		if err != nil {
			return err
		}
		defer setsFile.Close()
		options.ChainSpeed, err = observed.ParseChainSpeed(specFile, setsFile)
		if err != nil {
			return err
		}
		metadata["chain_speed"] = "bsl-gate-blood-debt"
		metadata["chain_spec"] = filepath.Base(*chainSpec)
		metadata["chain_sets"] = filepath.Base(*chainSets)
	}
	ob := observed.New(options)
	var files []string
	for _, path := range fs.Args() {
		files = append(files, filepath.Base(path))
		games, err := read(path)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		ob.Add(games)
	}
	b, err := json.MarshalIndent(struct {
		Files   []string `json:"files"`
		Options any      `json:"options"`
		observed.Result
	}{files, metadata, ob.Result()}, "", "  ")
	if err != nil {
		return err
	}
	if *out == "" {
		_, err = os.Stdout.Write(append(b, '\n'))
		return err
	}
	return os.WriteFile(*out, append(b, '\n'), 0o644)
}

func read(path string) ([]game.Game, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return game.ReadAll(f)
}

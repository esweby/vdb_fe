package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func chainPaths(t *testing.T) (string, string) {
	t.Helper()
	return "../../chains/bsl-gate-blood-debt.json", "../../chains/sets.json"
}

func TestChainFlagsMustBePaired(t *testing.T) {
	for _, flag := range []string{"-chain-spec", "-chain-sets"} {
		err := run([]string{flag, "unused", "../../game/testdata/games.csv"})
		if err == nil || !strings.Contains(err.Error(), "must be supplied together") {
			t.Fatalf("%s: got %v, want paired-flags error", flag, err)
		}
	}
}

func TestChainOutputPreservesExistingMetrics(t *testing.T) {
	spec, sets := chainPaths(t)
	readOutput := func(extra ...string) map[string]any {
		t.Helper()
		out := filepath.Join(t.TempDir(), "observed.json")
		args := append([]string{"-out", out}, extra...)
		args = append(args, "../../game/testdata/games.csv")
		if err := run(args); err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(out)
		if err != nil {
			t.Fatal(err)
		}
		var result map[string]any
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	plain := readOutput()
	if strings.Contains(mustJSON(t, plain), "chain_speed") {
		t.Fatal("default output includes chain_speed")
	}
	enabled := readOutput("-chain-spec", spec, "-chain-sets", sets)
	options := enabled["options"].(map[string]any)
	if options["chain_spec"] != filepath.Base(spec) || options["chain_sets"] != filepath.Base(sets) || options["chain_speed"] != "bsl-gate-blood-debt" {
		t.Fatalf("missing enabling metadata: %v", options)
	}
	delete(options, "chain_spec")
	delete(options, "chain_sets")
	delete(options, "chain_speed")
	strip := func(group any) {
		t.Helper()
		value := group.(map[string]any)
		if value["chain_speed"] == nil {
			t.Fatal("missing chain_speed")
		}
		delete(value, "chain_speed")
	}
	strip(enabled["pooled"])
	for _, key := range []string{"by_format", "by_first_player", "by_opponent"} {
		for _, group := range enabled[key].(map[string]any) {
			strip(group)
		}
	}
	if !reflect.DeepEqual(plain, enabled) {
		t.Fatal("enabling chain measurement changed existing metrics or metadata")
	}
}

func mustJSON(t *testing.T, value any) string {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestChainInputErrors(t *testing.T) {
	spec, sets := chainPaths(t)
	for _, paths := range [][2]string{{"missing-spec.json", sets}, {spec, "missing-sets.json"}} {
		if err := run([]string{"-chain-spec", paths[0], "-chain-sets", paths[1], "../../game/testdata/games.csv"}); err == nil {
			t.Fatal("missing chain input accepted")
		}
	}
	if err := run([]string{"-chain-spec", spec, "-chain-sets", sets}); err == nil || !strings.Contains(err.Error(), "no CSV files") {
		t.Fatalf("missing CSV: %v", err)
	}
	if err := run([]string{"-chain-spec"}); err == nil {
		t.Fatal("missing flag value accepted")
	}
}

func TestRejectsUnrelatedOrChangedChain(t *testing.T) {
	spec, sets := chainPaths(t)
	data, err := os.ReadFile(spec)
	if err != nil {
		t.Fatal(err)
	}
	for _, replacement := range [][2]string{
		{`"bsl-gate-blood-debt"`, `"another-chain"`},
		{`"withinTurns": 2`, `"withinTurns": 3`},
		{`"withinTurns": 0`, `"withinTurns": 1`},
		{`"action": "M"`, `"action": "A"`},
		{`"name": "setup"`, `"name": "setup", "anyOrder": true, "withinTurns": 0`},
		{`"name": "gate"`, `"name": "gate", "unless": [{"action":"M","card":"other"}]`},
		{`"set": "blood_debt"`, `"card": "deadwood_dirge_red"`},
	} {
		t.Run(replacement[1], func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "spec.json")
			changed := strings.Replace(string(data), replacement[0], replacement[1], 1)
			if changed == string(data) {
				t.Fatal("fixture replacement did not change spec")
			}
			if err := os.WriteFile(path, []byte(changed), 0600); err != nil {
				t.Fatal(err)
			}
			err := run([]string{"-chain-spec", path, "-chain-sets", sets, "../../game/testdata/games.csv"})
			if err == nil || !strings.Contains(err.Error(), "chain speed") {
				t.Fatalf("changed chain: got %v, want chain speed validation error", err)
			}
		})
	}
}

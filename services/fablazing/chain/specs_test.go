package chain

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// Every registered spec in chains/ must parse against chains/sets.json, so a
// regenerated sets file can't drop a set a chain uses.
func TestEverySpecParsesAgainstTheExportedSets(t *testing.T) {
	b, err := os.ReadFile("../chains/sets.json")
	if err != nil {
		t.Fatal(err)
	}
	var raw map[string][]string
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatal(err)
	}
	sets := Sets{}
	for name, ids := range raw {
		sets[name] = map[string]bool{}
		for _, id := range ids {
			sets[name][id] = true
		}
	}
	paths, _ := filepath.Glob("../chains/*.json")
	n := 0
	for _, p := range paths {
		if filepath.Base(p) == "sets.json" {
			continue
		}
		f, err := os.Open(p)
		if err != nil {
			t.Fatal(err)
		}
		s, err := ParseSpec(f, sets)
		f.Close()
		if err != nil {
			t.Errorf("%s: %v", p, err)
			continue
		}
		if !s.Registered() {
			t.Errorf("%s has no expectation", p)
		}
		n++
	}
	if n < 11 {
		t.Errorf("found %d specs, want the 9 measured and the 2 Open the Gate chains", n)
	}
}

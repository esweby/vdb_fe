package observed

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/esweby/vdb_fe/services/fablazing/chain"
)

// ChainSpeedSpec is the validated T5 chain. Its zero value disables measurement.
type ChainSpeedSpec struct {
	spec chain.Spec
}

// ChainSpeed counts one best attempt per included side. ByDelay counts only
// completions; Reached[3] is the denominator for completion-delay shares.
type ChainSpeed struct {
	Chain      string `json:"chain"`
	Population int    `json:"population"`
	Reached    [4]int `json:"reached"`
	ByDelay    [3]int `json:"by_delay"`
}

// ParseChainSpeed reads card sets and the registered bsl-gate-blood-debt spec,
// rejecting changes to the steps that define T5's matching and delay windows.
func ParseChainSpeed(specReader, setsReader io.Reader) (*ChainSpeedSpec, error) {
	var raw map[string][]string
	if err := json.NewDecoder(setsReader).Decode(&raw); err != nil {
		return nil, fmt.Errorf("chain speed sets: %w", err)
	}
	sets := chain.Sets{}
	for name, ids := range raw {
		sets[name] = map[string]bool{}
		for _, id := range ids {
			sets[name][id] = true
		}
	}
	if len(sets["blood_debt"]) == 0 || sets["blood_debt"][""] {
		return nil, fmt.Errorf("chain speed needs a non-empty blood_debt card set")
	}
	spec, err := chain.ParseSpec(specReader, sets)
	if err != nil {
		return nil, fmt.Errorf("chain speed: %w", err)
	}
	if spec.ID != "bsl-gate-blood-debt" || !spec.Registered() || spec.CompareBase != "" || spec.CompareFrom != "" || len(spec.Steps) != 3 {
		return nil, fmt.Errorf("chain speed needs the registered bsl-gate-blood-debt spec")
	}
	names := [3]string{"setup", "gate", "payoff"}
	cards := [3]string{"become_the_shadow_lord_blue", "gate_to_iarathael", ""}
	cardSets := [3]string{"", "", "blood_debt"}
	windows := [3]int{0, 2, 0}
	for index, step := range spec.Steps {
		windowOK := step.WithinTurns == nil
		if index > 0 {
			windowOK = step.WithinTurns != nil && *step.WithinTurns == windows[index]
		}
		if step.Name != names[index] || step.Action != "M" || len(step.Actions) != 0 || step.Card != cards[index] || step.Set != cardSets[index] || step.AnyCard || step.AnyOrder || len(step.Unless) != 0 || !windowOK {
			return nil, fmt.Errorf("chain speed: unexpected bsl-gate-blood-debt step %d", index)
		}
	}
	return &ChainSpeedSpec{spec: spec}, nil
}

func (s *ChainSpeedSpec) enabled() bool {
	return s != nil && s.spec.ID != ""
}

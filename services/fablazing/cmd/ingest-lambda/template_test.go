package main

import (
	"os"
	"strings"
	"testing"
)

// The daily FaBlazing pull was paused on 31 Oct 2026 and resumed on 1 Nov. The
// schedule's state lives in template.yaml, so a deploy sets it; flip this test to pause.
func TestDailyScheduleIsEnabled(t *testing.T) {
	raw, err := os.ReadFile("../../template.yaml")
	if err != nil {
		t.Fatal(err)
	}
	block := eventBlock(string(raw), "Daily:")
	if block == "" {
		t.Fatal("no Daily event in template.yaml")
	}
	if !strings.Contains(block, "Name: vdb-fablazing-daily") {
		t.Fatalf("Daily event isn't vdb-fablazing-daily:\n%s", block)
	}
	if !strings.Contains(block, "State: ENABLED") {
		t.Errorf("vdb-fablazing-daily should be State: ENABLED:\n%s", block)
	}
}

// eventBlock returns the lines from the line holding key up to the next line
// indented no deeper than it.
func eventBlock(template, key string) string {
	lines := strings.Split(template, "\n")
	for i, line := range lines {
		if strings.TrimSpace(line) != key {
			continue
		}
		indent := len(line) - len(strings.TrimLeft(line, " "))
		end := i + 1
		for end < len(lines) {
			next := lines[end]
			if strings.TrimSpace(next) != "" && len(next)-len(strings.TrimLeft(next, " ")) <= indent {
				break
			}
			end++
		}
		return strings.Join(lines[i:end], "\n")
	}
	return ""
}

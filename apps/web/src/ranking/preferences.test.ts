import { describe, expect, it } from "vitest";
import { PREFERENCES, preferenceBoost } from "./preferences.ts";

const neutral = Object.fromEntries(PREFERENCES.map((p) => [p.id, 50]));

describe("preferenceBoost", () => {
  it("is 0 when every preference is neutral", () => {
    expect(preferenceBoost(["rune_gate", "usurp"], neutral)).toBe(0);
  });

  it("floats preferred cards up to 25 and their companions half that", () => {
    const prefs = { ...neutral, runeGate: 100 };
    expect(preferenceBoost(["rune_gate"], prefs)).toBe(25);
    expect(preferenceBoost(["runechant_generator"], prefs)).toBe(12.5);
    expect(preferenceBoost(["sinchant"], prefs)).toBe(12.5);
    expect(preferenceBoost(["gate_target"], prefs)).toBe(0);
  });

  it("sinks avoided cards the same way", () => {
    expect(preferenceBoost(["usurp"], { ...neutral, usurp: 0 })).toBe(-25);
    expect(preferenceBoost(["usurp_payoff"], { ...neutral, usurp: 0 })).toBe(
      -12.5,
    );
  });

  it("counts Gate targets only when they aren't Rune Gate or Usurp cards (maintainer, 15 Oct 2026)", () => {
    const prefs = { ...neutral, gateTargets: 100 };
    expect(preferenceBoost(["gate_target"], prefs)).toBe(25);
    expect(preferenceBoost(["gate_target", "rune_gate"], prefs)).toBe(0);
    expect(preferenceBoost(["gate_target", "usurp"], prefs)).toBe(0);
    expect(preferenceBoost(["gate_generator"], prefs)).toBe(12.5);
  });

  it("adds up across preferences, a card counting once per preference", () => {
    const prefs = { ...neutral, usurp: 100, disruption: 100 };
    expect(preferenceBoost(["usurp", "disruption"], prefs)).toBe(50);
  });
});

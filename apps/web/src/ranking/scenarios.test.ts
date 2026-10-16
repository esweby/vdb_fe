import { scenarioSchema } from "@vdb/engine";
import { lacking } from "./scenarioRuns.ts";
import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { BUILT_IN_SCENARIOS, toEngineCard } from "./scenarios.ts";

const byName = (name: string) => sampleCards.find((c) => c.name === name)!;

describe("built-in scenarios", () => {
  it("are all valid scenario definitions", () => {
    for (const s of BUILT_IN_SCENARIOS) {
      expect(scenarioSchema.safeParse(s.definition).success).toBe(true);
    }
  });

  it("only check one hand: a 'by turn N' scenario would be the same as any turn's hand", () => {
    for (const s of BUILT_IN_SCENARIOS) {
      expect(s.definition.name).not.toMatch(/^By turn/);
    }
  });

  it("have distinct names", () => {
    const names = BUILT_IN_SCENARIOS.map((s) => s.definition.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("toEngineCard", () => {
  it("records Runechants and Gates made, with and without conditions", () => {
    const bsl = byName("Become the Shadow Lord");
    const card = toEngineCard(bsl, bsl.variants[0]!, ["gate_generator"]);
    // Both of its tokens depend on what it banishes.
    expect(card.amounts).toEqual({
      runechants: 1,
      runechantsUnconditional: 0,
      gates: 1,
      gatesUnconditional: 0,
    });
    expect(card.roles).toEqual(["gate_generator"]);
    expect(card.traits).toContain("shadow");
    expect(card.traits).toContain("runeblade");
  });

  it("takes each pitch's own attributes and keeps blood debt as a trait", () => {
    const hp = byName("Hocus Pocus");
    const card = toEngineCard(hp, hp.variants[0]!, []);
    expect(card.amounts.runechants).toBe(1);
    expect(card.amounts.runechantsUnconditional).toBe(1);
    expect(card.traits).toContain("blood_debt");
    expect(card.pitch).toBe(1);
    expect(card.name).toBe("Hocus Pocus");
  });
});

describe("what a core can't meet", () => {
  const card = (roles: string[]) => ({
    id: roles.join(),
    name: "Card",
    pitch: 1,
    roles,
    traits: [],
    amounts: { runechants: 0 },
  });
  const banish = {
    all: [
      {
        any: [
          { label: "a banisher", filter: { role: "hand_banisher" }, min: 1 },
          { label: "a banisher", filter: { role: "self_banisher" }, min: 1 },
        ],
      },
      { label: "a payoff", filter: { role: "plays_from_banish" }, min: 1 },
    ],
  };

  it("needs only one of an 'any' group, and names the first thing missing", () => {
    expect(
      lacking(banish, [card(["self_banisher"]), card(["plays_from_banish"])]),
    ).toBeUndefined();
    expect(lacking(banish, [card(["plays_from_banish"])])).toBe("a banisher");
    expect(lacking(banish, [card(["hand_banisher"])])).toBe("a payoff");
  });

  it("counts a total only from cards that make some", () => {
    const three = {
      all: [{ label: "3 Runechants", filter: {}, total: "runechants", min: 3 }],
    };
    expect(lacking(three, [card([])])).toBe("3 Runechants");
    expect(
      lacking(three, [{ ...card([]), amounts: { runechants: 1 } }]),
    ).toBeUndefined();
  });
});

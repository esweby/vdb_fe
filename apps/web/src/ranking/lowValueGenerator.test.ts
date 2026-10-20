// The maintainer, 20 Oct 2026: a Runechant generator in a core should make 3, or make them over a
// number of turns. Blue Runeblood Incantation makes one and is done, so the core builder
// discourages it.
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import {
  lowValueGenerator,
  withGeneratorPenalty,
} from "./lowValueGenerator.ts";

type Token = { token: string; amount: number | "X"; trigger: string };
const card = (
  name: string,
  tokensByPitch: Record<number, Token[]>,
  over: Partial<CardSummary> = {},
): CardSummary =>
  ({
    id: name,
    name,
    type: "action",
    subtypes: [],
    classes: ["Runeblade"],
    talents: [],
    keywords: [],
    attributes: { groups: [] },
    variants: Object.entries(tokensByPitch).map(([pitch, tokens]) => ({
      id: `${name}-${pitch}`,
      pitch: Number(pitch),
      cost: 1,
      power: null,
      defense: 2,
      imageUrl: null,
      attributes: { tokens },
    })),
    ...over,
  }) as unknown as CardSummary;

const low = (c: CardSummary, pitch: number) =>
  lowValueGenerator(
    c,
    c.variants.find((v) => v.pitch === pitch)!,
  );

const verses = (trigger: string) => ({
  1: [{ token: "runechant", amount: 3, trigger }],
  2: [{ token: "runechant", amount: 2, trigger }],
  3: [{ token: "runechant", amount: 1, trigger }],
});

describe("lowValueGenerator", () => {
  it("marks blue Runeblood Incantation, which makes one Runechant and is done", () => {
    const runeblood = card(
      "Runeblood Incantation",
      verses("start_of_action_phase"),
      { subtypes: ["Aura"] },
    );
    expect(low(runeblood, 3)).toBe(true);
    // Red makes 3; yellow makes them over two turns.
    expect(low(runeblood, 1)).toBe(false);
    expect(low(runeblood, 2)).toBe(false);
  });

  it("marks blue Malefic Incantation the same way", () => {
    const malefic = card(
      "Malefic Incantation",
      verses("your_attack_action_played"),
      { subtypes: ["Aura"] },
    );
    expect([1, 2, 3].map((p) => low(malefic, p))).toEqual([false, false, true]);
  });

  it("marks a card that makes fewer than 3 all at once, a turn later (Blessing of Occult)", () => {
    const blessing = card("Blessing of Occult", verses("start_of_turn"), {
      subtypes: ["Aura"],
    });
    expect([1, 2, 3].map((p) => low(blessing, p))).toEqual([false, true, true]);
  });

  it("leaves other cards alone, such as attacks that make a Runechant", () => {
    const hocus = card(
      "Hocus Pocus",
      { 1: [{ token: "runechant", amount: 1, trigger: "on_attack" }] },
      { type: "attack_action" },
    );
    expect(low(hocus, 1)).toBe(false);
    const sins = card("Otherworldly Sins", {
      3: [{ token: "runechant", amount: 1, trigger: "on_play" }],
    });
    expect(low(sins, 3)).toBe(false);
  });
});

describe("discouraged in the core builder", () => {
  it("drops a low-value pitch below a card it would otherwise beat", () => {
    expect(withGeneratorPenalty(60, true)).toBeLessThan(
      withGeneratorPenalty(40, false),
    );
    expect(withGeneratorPenalty(60, false)).toBe(60);
  });
});

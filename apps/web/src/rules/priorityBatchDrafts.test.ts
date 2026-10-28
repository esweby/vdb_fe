// Drafts approved by the maintainer on 26 Oct 2026.
import {
  parseEffects,
  parseTriggers,
  verifiedRulesFor,
} from "@esweby/fab-engine/rules";
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";

const base = sampleCards[0]!;
const variants = (
  attributes: CardSummary["variants"][number]["attributes"] = {},
) =>
  [1, 2, 3].map((pitch) => ({
    ...base.variants[0]!,
    id: `variant-${pitch}`,
    pitch,
    attributes,
  }));

const embrace: CardSummary = {
  ...base,
  name: "Embrace Ursur",
  type: "attack_action",
  attributes: {
    ...base.attributes,
    hasGoAgain: false,
    tokens: [
      {
        token: "runechant",
        amount: 1,
        trigger: "on_attack",
        conditions: ["banished_card_is_runeblade"],
      },
    ],
    banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
    goAgain: { conditions: ["banished_card_is_shadow"] },
  },
  variants: variants(),
};

const pull: CardSummary = {
  ...base,
  name: "Pull from Beyond",
  type: "action",
  attributes: {
    ...base.attributes,
    tokens: [
      {
        token: "gate",
        amount: 1,
        trigger: "on_play",
        conditions: ["top_card_matches_pitch"],
      },
    ],
    banishesOwn: [{ from: "deck_top", trigger: "on_play" }],
  },
  variants: [1, 2, 3].map((pitch) => ({
    ...base.variants[0]!,
    id: `pull-${pitch}`,
    pitch,
    attributes: { opt: [{ amount: 2, trigger: "on_play" }] },
  })),
};

const widespread = (
  name: string,
  pitch: number,
  from: "hand" | "arsenal" | "deck_top",
): CardSummary => ({
  ...base,
  name,
  type: "attack_action",
  attributes: {
    ...base.attributes,
    tokens: [],
    banishesOwn: [],
    disrupts: [
      {
        action: "banish",
        from,
        amount: 1,
        target: "each_hero",
        trigger: "combat_chain_closes",
        conditions: ["hero_lost_life_this_turn"],
      },
    ],
    notes: "Only heroes who have lost life this turn.",
  },
  variants: [{ ...base.variants[0]!, pitch, attributes: {} }],
});

describe("the first priority rules batch", () => {
  it("verifies Embrace Ursur as one three-pitch rule", () => {
    const entry = draftQueue([embrace])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts).toHaveLength(1);
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.rules.triggers).toMatchObject([
      {
        on: { event: "attacking", self: true },
        effects: [
          {
            op: "banish",
            from: "hand",
            amount: 1,
            optional: true,
            storeAs: "banished",
          },
          { op: "if", check: { has: "runeblade", target: "banished" } },
          { op: "if", check: { has: "shadow", target: "banished" } },
        ],
      },
    ]);
    expect(() =>
      parseTriggers(entry.drafts[0]!.draft.rules.triggers),
    ).not.toThrow();
    for (const pitch of [1, 2, 3])
      expect(verifiedRulesFor(embrace.name, pitch)).toEqual(
        entry.drafts[0]!.draft.rules,
      );
  });

  it("drafts each Pull from Beyond pitch through Opt, banish and matching Gate", () => {
    const entry = draftQueue([pull])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts).toHaveLength(3);
    for (const queued of entry.drafts) {
      const pitch = queued.pitches[0]!;
      expect(queued.draft.rules.effects).toEqual([
        { op: "opt", amount: 2, keepPitch: pitch },
        { op: "banish", from: "deckTop", amount: 1, storeAs: "banished" },
        {
          op: "if",
          check: { pitch, target: "banished" },
          then: [{ op: "createToken", token: "gate", amount: 1 }],
        },
      ]);
      expect(() => parseEffects(queued.draft.rules.effects)).not.toThrow();
      expect(verifiedRulesFor(pull.name, pitch)).toEqual(queued.draft.rules);
    }
  });

  it.each([
    ["Widespread Annihilation", 3, "hand"],
    ["Widespread Destruction", 2, "arsenal"],
    ["Widespread Ruin", 1, "deck_top"],
  ] as const)(
    "keeps %s's combat-chain effect visible but out of scope",
    (name, pitch, from) => {
      const entry = draftQueue([widespread(name, pitch, from)])[0]!;
      expect(entry.status).toBe("verified");
      expect(entry.verified).toBe(true);
      expect(entry.drafts[0]!.draft.rules.effects).toEqual([]);
      expect(entry.drafts[0]!.draft.outOfScope).toEqual([
        "Each hero banishes when the combat chain closes: combat is out of scope",
      ]);
      expect(verifiedRulesFor(name, pitch)).toEqual(
        entry.drafts[0]!.draft.rules,
      );
    },
  );
});

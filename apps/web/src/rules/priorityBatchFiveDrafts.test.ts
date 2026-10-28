// Fallen Herald and Haunting Rendition approved by the maintainer on 27 Oct 2026.
// The other three effect drafts remain UNVERIFIED.
import { parseEffects, verifiedRulesFor } from "@esweby/fab-engine/rules";
import { describe, expect, it } from "vitest";
import { remaining } from "../../../../packages/importer/src/authored/05-remaining.ts";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";

const base = sampleCards[0]!;
const variant = (
  id: string,
  pitch: number,
  attributes: CardSummary["variants"][number]["attributes"] = {},
) => ({ ...base.variants[0]!, id, pitch, attributes });

const card = (
  name: string,
  type: string,
  attributes: Partial<CardSummary["attributes"]>,
  cardVariants: CardSummary["variants"],
): CardSummary => ({
  ...base,
  name,
  type,
  attributes: {
    ...base.attributes,
    hasBloodDebt: false,
    hasRuneGate: false,
    isGateTarget: false,
    ...attributes,
  },
  variants: cardVariants,
});

const fallen = card(
  "Fallen Herald",
  "attack_action",
  {
    hasBloodDebt: true,
    banishesSelf: [{ from: "hand", trigger: "activated" }],
    notes: "Banish it from hand to prevent the next 4 damage.",
  },
  [
    variant("fallen-yellow", 2, {
      activation: {
        speed: "instant",
        cost: 0,
        pay: "banish_from_hand",
      },
    }),
  ],
);

const sink = card(
  "Sink Below",
  "defense_reaction",
  remaining["Sink Below"]?.card ?? {},
  [1, 2, 3].map((pitch) => variant(`sink-${pitch}`, pitch)),
);

const haunting = card(
  "Haunting Rendition",
  "block",
  {
    tokens: [{ token: "runechant", amount: 1, trigger: "activated" }],
    notes:
      "Discard to prevent the next 2 damage; the Runechant comes the first time damage is prevented this way.",
  },
  [
    variant("haunting-red", 1, {
      activation: { speed: "instant", cost: 0, pay: "discard" },
    }),
  ],
);

const swarming = card(
  "Swarming Gloomveil",
  "attack_action",
  {
    goAgain: { conditions: ["played_or_created_aura_this_turn"] },
    conditionalBonuses: [
      {
        effect: "plus_power",
        amount: 1,
        conditions: ["played_or_created_2_or_more_auras_this_turn"],
      },
      {
        effect: "arcane_cant_be_prevented",
        conditions: ["played_or_created_3_or_more_auras_this_turn"],
      },
    ],
    notes:
      "The thresholds stack: with 3 or more auras it has go again, +1 power and the arcane effect.",
  },
  [variant("swarming-red", 1)],
);

const machinations = card(
  "Machinations of Dominion",
  "action",
  {
    conditionalBonuses: [
      { effect: "overpower", grantedTo: "next_runeblade_attack_action" },
    ],
    grantsGoAgain: {
      to: "next_runeblade_attack_action",
      conditions: ["played_or_created_aura_this_turn"],
    },
  },
  [variant("machinations-blue", 3)],
);

describe("the fifth priority rules batch", () => {
  it("drafts Fallen Herald's hand activation without guessing prevention", () => {
    const entry = draftQueue([fallen])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [],
      activate: {
        speed: "instant",
        cost: 0,
        pay: "banish_from_hand",
        effects: [],
      },
    });
    expect(verifiedRulesFor(fallen.name, 2)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
    expect(entry.drafts[0]!.draft.factsNote).toContain("prevent the next 4");
  });

  it("keeps all Sink Below pitches together and outside the engine", () => {
    const queue = draftQueue([sink]);
    expect(queue).toHaveLength(1);
    const entry = queue[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts).toHaveLength(1);
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("draw a card");
  });

  it("drafts Haunting Rendition's activation and keeps prevention in its note", () => {
    const entry = draftQueue([haunting])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [],
      activate: {
        speed: "instant",
        cost: 0,
        pay: "discard",
        effects: [{ op: "createToken", token: "runechant", amount: 1 }],
      },
    });
    expect(() =>
      parseEffects(entry.drafts[0]!.draft.rules.activate?.effects),
    ).not.toThrow();
    expect(verifiedRulesFor(haunting.name, 1)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("keeps Swarming Gloomveil's aura thresholds visible but unsupported", () => {
    const entry = draftQueue([swarming])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Go again if you've played or created an aura this turn: the engine can't check that yet",
    ]);
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Bonuses to power or defence: combat is out of scope",
    ]);
  });

  it("keeps Machinations' grant to the next attack unsupported", () => {
    const entry = draftQueue([machinations])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Go again given to a later card: not drafted yet",
    ]);
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Bonuses to power or defence: combat is out of scope",
    ]);
  });

  it.each([
    ["Sink Below", 1],
    ["Swarming Gloomveil", 1],
    ["Machinations of Dominion", 3],
  ])("keeps %s pitch %s unverified", (name, pitch) => {
    expect(verifiedRulesFor(name, pitch)).toBeUndefined();
  });
});

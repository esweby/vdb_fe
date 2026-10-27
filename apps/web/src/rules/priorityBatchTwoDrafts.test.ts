// UNVERIFIED effect drafts. The maintainer must approve these five cards before they gain rules.
import { parseEffects, verifiedRulesFor } from "@vdb/engine/rules";
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

const card = (
  name: string,
  attributes: Partial<CardSummary["attributes"]>,
  cardVariants = variants(),
): CardSummary => ({
  ...base,
  name,
  type: "action",
  attributes: {
    ...base.attributes,
    hasBloodDebt: false,
    hasRuneGate: false,
    isGateTarget: false,
    ...attributes,
  },
  variants: cardVariants,
});

const vantom = card("Vantom Wraith", {
  hasRuneGate: true,
  hasBloodDebt: true,
});

const deadwood = card("Deadwood Dirge", {}, [
  {
    ...base.variants[0]!,
    id: "deadwood-red",
    pitch: 1,
    attributes: {
      tokens: [
        {
          token: "runechant",
          amount: 3,
          trigger: "on_play",
          conditions: ["destroyed_own_aura"],
        },
      ],
    },
  },
  {
    ...base.variants[0]!,
    id: "deadwood-yellow",
    pitch: 2,
    attributes: {
      tokens: [
        {
          token: "runechant",
          amount: 2,
          trigger: "on_play",
          conditions: ["destroyed_own_aura"],
        },
      ],
    },
  },
  {
    ...base.variants[0]!,
    id: "deadwood-blue",
    pitch: 3,
    attributes: {
      tokens: [
        {
          token: "runechant",
          amount: 1,
          trigger: "on_play",
          conditions: ["destroyed_own_aura"],
        },
      ],
    },
  },
]);

const shadow = card(
  "Shadow of Ursur",
  {
    playableFromBanish: {},
    banishesOwn: [{ from: "hand", trigger: "on_play", optional: true }],
    goAgain: { conditions: ["paid_optional_additional_cost"] },
    notes:
      "The optional additional cost is banishing a blood debt card from your hand.",
  },
  [{ ...base.variants[0]!, id: "shadow-blue", pitch: 3, attributes: {} }],
);

const revel = card(
  "Revel in Runeblood",
  {
    tokens: [
      {
        token: "runechant",
        amount: 4,
        trigger: "on_play",
        conditions: [
          "played_attack_action_this_turn",
          "played_non_attack_action_this_turn",
        ],
      },
    ],
    notes:
      "Requires another non-attack action card besides this one. Destroys all your Runechants at your end phase.",
  },
  [{ ...base.variants[0]!, id: "revel-red", pitch: 1, attributes: {} }],
);

const enshrine = card(
  "Enshrine Sin",
  {
    playableFromBanish: {},
    tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
    notes: "Costs {r} equal to pitch value when played from banish.",
  },
  variants({ opt: [{ amount: 1, trigger: "on_play" }] }),
);

describe("the second priority rules batch", () => {
  it("shows Vantom Wraith's Rune Gate and blood debt traits for review", () => {
    const entry = draftQueue([vantom])[0]!;
    expect(entry.status).toBe("complete");
    expect(entry.verified).toBe(false);
    expect(entry.drafts).toHaveLength(1);
    expect(entry.drafts[0]!.draft.description).toEqual([
      "Rune Gate.",
      "Blood debt.",
    ]);
    expect(entry.drafts[0]!.draft.rules.effects).toEqual([]);
  });

  it("keeps Deadwood Dirge's aura cost visible until the engine can pay it", () => {
    const entry = draftQueue([deadwood])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts).toHaveLength(3);
    expect(entry.drafts.map((draft) => draft.pitches)).toEqual([[1], [2], [3]]);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "3 Runechants if you destroyed an aura you control: the engine can't check that yet",
    ]);
    expect(entry.drafts[1]!.draft.notDrafted).toEqual([
      "2 Runechants if you destroyed an aura you control: the engine can't check that yet",
    ]);
    expect(entry.drafts[2]!.draft.notDrafted).toEqual([
      "1 Runechant if you destroyed an aura you control: the engine can't check that yet",
    ]);
  });

  it("drafts Shadow of Ursur's supported text and calls out the additional cost", () => {
    const entry = draftQueue([shadow])[0]!;
    expect(entry.status).toBe("partial");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.draft.rules).toMatchObject({
      effects: [
        {
          op: "banish",
          from: "hand",
          amount: 1,
          optional: true,
          storeAs: "banished",
        },
      ],
      playableFromBanish: true,
    });
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Go again if you paid its optional additional cost: the engine can't check that yet",
    ]);
    expect(() =>
      parseEffects(entry.drafts[0]!.draft.rules.effects),
    ).not.toThrow();
  });

  it("keeps Revel in Runeblood's two earlier plays visible", () => {
    const entry = draftQueue([revel])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "4 Runechants if you've played an attack action card this turn: the engine can't check that yet",
    ]);
    expect(entry.drafts[0]!.draft.factsNote).toContain(
      "another non-attack action card besides this one",
    );
  });

  it("drafts Enshrine Sin's supported text together for all three pitches", () => {
    const entry = draftQueue([enshrine])[0]!;
    expect(entry.status).toBe("complete");
    expect(entry.verified).toBe(false);
    expect(entry.drafts).toHaveLength(1);
    expect(entry.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(entry.drafts[0]!.draft.rules).toMatchObject({
      effects: [
        { op: "opt", amount: 1 },
        { op: "createToken", token: "runechant", amount: 1 },
      ],
      playableFromBanish: true,
    });
    expect(entry.drafts[0]!.draft.factsNote).toContain("equal to pitch value");
  });

  it.each([
    ["Vantom Wraith", 1],
    ["Deadwood Dirge", 1],
    ["Shadow of Ursur", 3],
    ["Revel in Runeblood", 1],
    ["Enshrine Sin", 1],
  ])("keeps %s pitch %s unverified", (name, pitch) => {
    expect(verifiedRulesFor(name, pitch)).toBeUndefined();
  });
});

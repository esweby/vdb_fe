// Invert Existence and Painful Passage approved by the maintainer on 27 Oct 2026.
// The other three effect drafts remain UNVERIFIED.
import { parseEffects, verifiedRulesFor } from "@vdb/engine/rules";
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

const runeblood = card(
  "Runeblood Incantation",
  "action",
  {
    notes:
      "One Runechant per turn at the start of your action phase, until its verse counters run out.",
  },
  [
    variant("runeblood-red", 1, {
      tokens: [
        { token: "runechant", amount: 3, trigger: "start_of_action_phase" },
      ],
    }),
    variant("runeblood-yellow", 2, {
      tokens: [
        { token: "runechant", amount: 2, trigger: "start_of_action_phase" },
      ],
    }),
    variant("runeblood-blue", 3, {
      tokens: [
        { token: "runechant", amount: 1, trigger: "start_of_action_phase" },
      ],
    }),
  ],
);

const invert = card(
  "Invert Existence",
  "instant",
  {
    hasBloodDebt: true,
    playableFromBanish: {},
    disrupts: [
      {
        action: "banish",
        from: "graveyard",
        amount: 2,
        target: "opponent",
        trigger: "on_play",
        optional: true,
      },
    ],
    arcaneDamage: [{ amount: 2, trigger: "on_play" }],
    notes:
      "Up to 2 cards. The arcane damage needs an attack and a non-attack action card among them.",
  },
  [variant("invert-blue", 3)],
);

const eye = card("Eye of Ophidia", "resource", {}, [
  variant("eye-blue", 3, { opt: [{ amount: 2, trigger: "on_pitch" }] }),
]);

const painful = card(
  "Painful Passage",
  "action",
  {
    banishesOwn: [{ from: "hand", trigger: "on_play", optional: true }],
    grantsGoAgain: "banished_card",
    notes:
      "Banishes an attack action card; it gets your choice of +3 power or go again this turn.",
  },
  [variant("painful-red", 1)],
);

const call = card(
  "Call for Backup",
  "attack_action",
  remaining["Call for Backup"]?.card ?? {},
  [variant("call-red", 1)],
);

describe("the fourth priority rules batch", () => {
  it("keeps each Runeblood Incantation pitch separate and blocked", () => {
    const entry = draftQueue([runeblood])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts.map((draft) => draft.pitches)).toEqual([[1], [2], [3]]);
    expect(entry.drafts.map((draft) => draft.draft.notDrafted[0])).toEqual([
      "3 Runechants at the start of your action phase: not drafted yet",
      "2 Runechants at the start of your action phase: not drafted yet",
      "1 Runechant at the start of your action phase: not drafted yet",
    ]);
  });

  it("drafts Invert Existence's banished-zone permission only", () => {
    const entry = draftQueue([invert])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toEqual({
      effects: [],
      playableFromBanish: true,
    });
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Arcane damage: damage to an opponent is out of scope",
      "Disrupting an opponent: out of scope",
    ]);
    expect(verifiedRulesFor(invert.name, 3)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("keeps Eye of Ophidia's pitch Opt visible but unsupported", () => {
    const entry = draftQueue([eye])[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Opt when it's pitched: not drafted yet",
    ]);
  });

  it("drafts Painful Passage's optional banish and leaves its grant out", () => {
    const entry = draftQueue([painful])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules.effects).toEqual([
      {
        op: "banish",
        from: "hand",
        amount: 1,
        optional: true,
        storeAs: "banished",
      },
    ]);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Go again given to a later card: not drafted yet",
    ]);
    expect(() =>
      parseEffects(entry.drafts[0]!.draft.rules.effects),
    ).not.toThrow();
    expect(verifiedRulesFor(painful.name, 1)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("keeps Call for Backup's defend text visible and out of the engine", () => {
    const queue = draftQueue([call]);
    expect(queue).toHaveLength(1);
    const entry = queue[0]!;
    expect(entry.status).toBe("undraftable");
    expect(entry.verified).toBe(false);
    expect(entry.drafts[0]!.draft.rules.effects).toEqual([]);
    expect(entry.drafts[0]!.draft.factsNote).toContain("When this defends");
  });

  it.each([
    ["Runeblood Incantation", 1],
    ["Eye of Ophidia", 3],
    ["Call for Backup", 1],
  ])("keeps %s pitch %s unverified", (name, pitch) => {
    expect(verifiedRulesFor(name, pitch)).toBeUndefined();
  });
});

// Drafts approved by the maintainer on 27 Oct 2026.
import {
  parseEffects,
  parseTriggers,
  verifiedRulesFor,
} from "@vdb/engine/rules";
import { describe, expect, it } from "vitest";
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
  attributes: Partial<CardSummary["attributes"]>,
  cardVariants: CardSummary["variants"],
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

const openTheGate = card(
  "Open the Gate to i'Arathael",
  {
    tokens: [
      { token: "gate", amount: 1, trigger: "on_hit" },
      { token: "gate", amount: 1, trigger: "on_banished" },
    ],
    notes: "The banish trigger only counts when banished from hand or deck.",
  },
  [variant("open-red", 1)],
);

const succumb = card(
  "Succumb to Temptation",
  {
    instantSpeed: { conditions: ["dealt_arcane_damage_this_turn"] },
    disrupts: [
      {
        action: "discard",
        from: "hand",
        amount: 1,
        target: "defending_hero",
        trigger: "on_hit",
        grantedTo: "next_runeblade_attack_action",
      },
    ],
    notes: "You look at their hand and choose the card.",
  },
  [variant("succumb-yellow", 2)],
);

const walker = card(
  "Shadowrealm Walker",
  {
    banishesOwn: [{ from: "hand", trigger: "on_attack", optional: true }],
    tokens: [
      {
        token: "gate",
        amount: 1,
        trigger: "on_attack",
        conditions: ["banished_card_is_shadow"],
      },
    ],
  },
  [1, 2, 3].map((pitch) => variant(`walker-${pitch}`, pitch)),
);

const mordred = card(
  "Mordred Tide",
  {
    notes:
      "Doesn't create Runechants itself: until end of turn, each time you create Runechants you create 1 extra. The vocabulary can't express this yet.",
  },
  [variant("mordred-red", 1)],
);

const become = card(
  "Become the Arknight",
  {
    costReducedPerRunechant: true,
    tutors: [
      {
        target: { group: "runeblade_non_attack_action" },
        to: "hand",
        trigger: "on_play",
        conditions: ["discarded_attack_action"],
      },
      {
        target: { group: "runeblade_attack_action" },
        to: "hand",
        trigger: "on_play",
        conditions: ["discarded_non_attack_action"],
      },
    ],
    goAgain: { conditions: ["x_is_2_or_more"] },
    notes: "Discarding an action card is optional.",
  },
  [variant("become-blue", 3)],
);

describe("the third priority rules batch", () => {
  it("drafts Open the Gate's banish trigger and leaves its hit outside combat", () => {
    const entry = draftQueue([openTheGate])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toMatchObject({
      effects: [],
      triggers: [
        {
          on: { event: "moved", to: "banished", self: true },
          effects: [{ op: "createToken", token: "gate", amount: 1 }],
        },
      ],
    });
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Gates on hit: combat is out of scope",
    ]);
    expect(() =>
      parseTriggers(entry.drafts[0]!.draft.rules.triggers),
    ).not.toThrow();
    expect(verifiedRulesFor(openTheGate.name, 1)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("keeps Succumb to Temptation blocked instead of guessing at opponent play", () => {
    const entry = draftQueue([succumb])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Playing it as an instant: not drafted yet",
    ]);
    expect(entry.drafts[0]!.draft.outOfScope).toEqual([
      "Disrupting an opponent: out of scope",
    ]);
    expect(verifiedRulesFor(succumb.name, 2)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("drafts Shadowrealm Walker once for all pitches", () => {
    const entry = draftQueue([walker])[0]!;
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
          {
            op: "if",
            check: { has: "shadow", target: "banished" },
            then: [{ op: "createToken", token: "gate", amount: 1 }],
          },
        ],
      },
    ]);
    expect(() =>
      parseTriggers(entry.drafts[0]!.draft.rules.triggers),
    ).not.toThrow();
    for (const pitch of [1, 2, 3])
      expect(verifiedRulesFor(walker.name, pitch)).toEqual(
        entry.drafts[0]!.draft.rules,
      );
  });

  it("keeps Mordred Tide's replacement effect visible as a vocabulary gap", () => {
    const entry = draftQueue([mordred])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules.effects).toEqual([]);
    expect(entry.drafts[0]!.draft.factsNote).toContain(
      "each time you create Runechants you create 1 extra",
    );
    expect(verifiedRulesFor(mordred.name, 1)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });

  it("drafts Become the Arknight's reduction but not its discard and search", () => {
    const entry = draftQueue([become])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    expect(entry.drafts[0]!.draft.rules).toMatchObject({
      effects: [],
      costReductions: [{ amount: "perRunechant" }],
    });
    expect(entry.drafts[0]!.draft.notDrafted).toEqual([
      "Go again if X is 2 or more: the engine can't check that yet",
      "Searching the deck: not drafted yet",
    ]);
    expect(() =>
      parseEffects(entry.drafts[0]!.draft.rules.effects),
    ).not.toThrow();
    expect(verifiedRulesFor(become.name, 3)).toEqual(
      entry.drafts[0]!.draft.rules,
    );
  });
});

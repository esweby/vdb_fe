// Step 9 (docs/rules-engine.md): effects drafted from a card's recorded facts, marked unverified,
// for a player to check against the printed text. What can't be drafted is listed, never guessed.
import { CARD_RULES, describeEffects } from "@vdb/engine/rules";
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftEffects } from "./draftEffects.ts";

const byName = (name: string) => sampleCards.find((c) => c.name === name)!;
const withAttributes = (
  attributes: Partial<CardSummary["attributes"]>,
  over: Partial<CardSummary> = {},
): CardSummary => {
  const base = byName("Become the Shadow Lord");
  return {
    ...base,
    name: "Test card",
    ...over,
    attributes: {
      ...base.attributes,
      banishesOwn: [],
      tokens: [],
      ...attributes,
    },
  };
};

describe("draftEffects", () => {
  it("drafts Become the Shadow Lord's facts into the rules the maintainer signed off", () => {
    const bsl = byName("Become the Shadow Lord");
    const draft = draftEffects(bsl, bsl.variants[0]!);
    expect(draft.rules.effects).toEqual(
      CARD_RULES["Become the Shadow Lord"]!.effects,
    );
    expect(draft.notDrafted).toEqual([]);
  });

  it("drafts an on-attack Runechant as a 'when this attacks' trigger", () => {
    const hp = byName("Hocus Pocus");
    const draft = draftEffects(hp, hp.variants[0]!);
    expect(draft.rules.effects).toEqual([]);
    expect(draft.rules.triggers).toMatchObject([
      {
        on: { event: "attacking", self: true },
        effects: [{ op: "createToken", token: "runechant", amount: 1 }],
      },
    ]);
  });

  it("lists what it can't draft instead of guessing", () => {
    const card = withAttributes({
      tokens: [
        { token: "runechant", amount: "X", trigger: "on_play" },
        { token: "runechant", amount: 1, trigger: "on_hit" },
        {
          token: "runechant",
          amount: 1,
          trigger: "on_play",
          grantedTo: "next_attack_action",
        },
      ],
      arcaneDamage: [{ amount: 1, trigger: "on_play" }],
      disrupts: [
        {
          action: "discard",
          from: "hand",
          amount: 1,
          target: "opponent",
          trigger: "on_hit",
        },
      ],
    });
    const draft = draftEffects(card, card.variants[0]!);
    expect(draft.rules.effects).toEqual([]);
    expect(draft.notDrafted).toEqual([
      "X Runechants: the engine needs a number",
      "Runechants on hit: combat is out of scope",
      "Runechants given to a later card",
      "Arcane damage: damage to an opponent is out of scope",
      "Disrupting an opponent: out of scope",
    ]);
  });

  it("drafts conditional go again it can check, and notes the conditions it can't", () => {
    const card = withAttributes({
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
      goAgain: { conditions: ["banished_card_is_shadow"] },
    });
    expect(draftEffects(card, card.variants[0]!).rules.effects).toContainEqual({
      op: "if",
      check: { has: "shadow", target: "banished" },
      then: [{ op: "gainActionPoint" }],
    });
    const unknown = withAttributes({
      goAgain: { conditions: ["dealt_arcane_damage_this_turn"] },
    });
    expect(draftEffects(unknown, unknown.variants[0]!).notDrafted).toEqual([
      "Go again if you've dealt arcane damage this turn: the engine can't check that yet",
    ]);
  });

  it("carries Usurp and an unconditional play from the banished zone", () => {
    const card = withAttributes(
      { hasUsurp: true, playableFromBanish: {} },
      { type: "attack_action" },
    );
    expect(draftEffects(card, card.variants[0]!).rules).toMatchObject({
      usurp: true,
      playableFromBanish: true,
    });
  });
});

describe("describeEffects", () => {
  it("reads a draft in plain words, to check against the printed text", () => {
    expect(
      describeEffects(CARD_RULES["Become the Shadow Lord"]!.effects),
    ).toEqual([
      "Banish 1 card from your hand (the player chooses).",
      "If that card is Runeblade: create 1 Runechant.",
      "If that card is Shadow: create 1 Gate.",
    ]);
  });
});

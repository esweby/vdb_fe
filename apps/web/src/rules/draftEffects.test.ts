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
      "Runechants given to a later card",
    ]);
    expect(draft.outOfScope).toEqual([
      "Runechants on hit: combat is out of scope",
      "Arcane damage: damage to an opponent is out of scope",
      "Disrupting an opponent: out of scope",
    ]);
  });

  // The maintainer, 20 Oct 2026: Otherworldly Sins wasn't ready to check because of its power
  // bonus. Combat and opponents are out of the engine's scope, so they don't hold a draft back.
  it("is complete when all it leaves out is out of scope", () => {
    const card = withAttributes({
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
      conditionalBonuses: [
        {
          effect: "plus_power",
          amount: 3,
          grantedTo: "next_runeblade_or_shadow_attack",
        },
      ],
    });
    const draft = draftEffects(card, card.variants[0]!);
    expect(draft.notDrafted).toEqual([]);
    expect(draft.outOfScope).toEqual([
      "Bonuses to power or defence: combat is out of scope",
    ]);
    expect(draft.complete).toBe(true);
  });

  // The maintainer, 20 Oct 2026: Blood Tribute's draft must record Opt.
  it("drafts Opt before the card's other effects, as Blood Tribute reads", () => {
    const card = withAttributes({
      banishesOwn: [{ from: "deck_top", trigger: "on_play" }],
    });
    const red = {
      ...card.variants[0]!,
      attributes: { opt: [{ amount: 3, trigger: "on_play" as const }] },
    };
    const draft = draftEffects(card, red);
    expect(draft.rules.effects).toEqual([
      { op: "opt", amount: 3 },
      { op: "banish", from: "deckTop", amount: 1 },
    ]);
    expect(draft.complete).toBe(true);
  });

  // Pull from Beyond: "Opt 2. Banish the top card of your deck. If it's blue, create a Gate".
  it("drafts Opt keeping the card's own pitch on top when its Gate needs a matching card", () => {
    const card = withAttributes({
      opt: [{ amount: 2, trigger: "on_play" }],
      banishesOwn: [{ from: "deck_top", trigger: "on_play" }],
      tokens: [
        {
          token: "gate",
          amount: 1,
          trigger: "on_play",
          conditions: ["top_card_matches_pitch"],
        },
      ],
    });
    const blue = { ...card.variants[0]!, pitch: 3 };
    expect(draftEffects(card, blue).rules.effects[0]).toEqual({
      op: "opt",
      amount: 2,
      keepPitch: 3,
    });
  });

  it("drafts Opt when it attacks, and lists the Opt it can't draft", () => {
    const card = withAttributes({
      opt: [
        { amount: 1, trigger: "on_attack" },
        { amount: 2, trigger: "on_hit" },
        { amount: 1, trigger: "on_pitch" },
        { amount: 2, trigger: "on_play", fromArsenal: true },
      ],
    });
    const draft = draftEffects(card, card.variants[0]!);
    expect(draft.rules.triggers).toMatchObject([
      {
        on: { event: "attacking", self: true },
        effects: [{ op: "opt", amount: 1 }],
      },
    ]);
    expect(draft.outOfScope).toEqual([
      "Opt when it hits: combat is out of scope",
    ]);
    expect(draft.notDrafted).toEqual([
      "Opt when it's pitched: not drafted yet",
      "Opt if it was played from arsenal: the engine can't check that yet",
    ]);
  });

  it("isn't complete while the card's facts have a note to check by hand", () => {
    const card = withAttributes({ notes: "Something the facts can't say." });
    const draft = draftEffects(card, card.variants[0]!);
    expect(draft.complete).toBe(false);
    expect(draft.notDrafted).toContain(
      "A note on the card's facts, to check by hand: Something the facts can't say.",
    );
  });

  // Cards that banish themselves (20 Oct 2026): "instead of going to the graveyard" is drafted;
  // combat timings are out of scope; activated abilities aren't drafted yet.
  it("drafts banishing itself instead of going to the graveyard", () => {
    const card = withAttributes({
      banishesSelf: [{ trigger: "would_go_to_graveyard" }],
    });
    const draft = draftEffects(card, card.variants[0]!);
    expect(draft.rules.graveyardToBanish).toBe(true);
    expect(draft.description).toContain(
      "If it would go to the graveyard, it's banished instead.",
    );
    expect(draft.complete).toBe(true);
  });

  it("sorts the other times a card banishes itself", () => {
    const card = withAttributes({
      banishesSelf: [
        { trigger: "combat_chain_closes", conditions: ["it_defended"] },
        { trigger: "would_be_dealt_damage", optional: true },
        { from: "hand", trigger: "activated" },
      ],
    });
    const draft = draftEffects(card, card.variants[0]!);
    expect(draft.outOfScope).toEqual([
      "Banishing itself when the combat chain closes: combat is out of scope",
      "Banishing itself when you would be dealt damage: combat is out of scope",
    ]);
    expect(draft.notDrafted).toEqual([
      "Banishing itself when it's activated: activated abilities aren't drafted yet",
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

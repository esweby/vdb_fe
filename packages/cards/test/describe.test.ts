import { describe, expect, it } from "vitest";
import { describeAttributes } from "../src/describe.ts";

const generated = {
  hasGoAgain: false,
  hasBloodDebt: false,
  hasUsurp: false,
  hasRuneGate: false,
  specialization: null,
};

describe("describeAttributes", () => {
  it("describes Become the Shadow Lord in plain English", () => {
    expect(
      describeAttributes({
        ...generated,
        hasGoAgain: true,
        banishesOwn: [{ from: "hand", trigger: "on_play" }],
        tokens: [
          { token: "runechant", amount: 1, trigger: "on_play", conditions: ["banished_card_is_runeblade"] },
          { token: "gate", amount: 1, trigger: "on_play", conditions: ["banished_card_is_shadow"] },
        ],
      }),
    ).toEqual([
      "Banishes a card from your hand when played.",
      "Creates 1 Runechant when played, if the banished card is Runeblade.",
      "Creates 1 Gate to i'Arathael when played, if the banished card is Shadow.",
      "Go again.",
    ]);
  });

  it("pluralises tokens and describes variable amounts", () => {
    expect(
      describeAttributes({
        ...generated,
        tokens: [
          { token: "runechant", amount: 3, trigger: "on_leave_arena" },
          { token: "gate", amount: "X", trigger: "on_hit" },
          { token: "eloquence", amount: 2, trigger: "combat_chain_closes" },
        ],
      }),
    ).toEqual([
      "Creates 3 Runechants when it leaves the arena.",
      "Creates X Gates to i'Arathael when it hits.",
      "Creates 2 Eloquence tokens when the combat chain closes.",
    ]);
  });

  it("joins several conditions with 'and'", () => {
    expect(
      describeAttributes({
        ...generated,
        arcaneDamage: [
          {
            amount: 1,
            trigger: "on_attack",
            conditions: ["pitched_non_attack_action", "dealt_arcane_damage_this_turn"],
          },
        ],
      }),
    ).toEqual([
      "Deals 1 arcane damage when it attacks, if a non-attack action card was pitched to play it and you've dealt arcane damage this turn.",
    ]);
  });

  it("describes optional banishes, playing from banish and cost reduction", () => {
    expect(
      describeAttributes({
        ...generated,
        banishesOwn: [{ from: "deck_top", trigger: "on_attack", optional: true }],
        playableFromBanish: { conditions: ["played_non_attack_action_this_turn"] },
        costReducedPerRunechant: true,
      }),
    ).toEqual([
      "May banish the top card of your deck when it attacks.",
      "Can be played from your banished zone, if you've played a non-attack action card this turn.",
      "Costs {r} less for each Runechant you control.",
    ]);
  });

  it("describes generated keywords, specialization and notes", () => {
    expect(
      describeAttributes({
        hasGoAgain: true,
        hasBloodDebt: true,
        hasUsurp: true,
        hasRuneGate: true,
        specialization: "Viserai",
        playableFromBanish: {},
        notes: "Unsure whether the Gate is optional.",
      }),
    ).toEqual([
      "Viserai specialization.",
      "Can be played from your banished zone.",
      "Usurp.",
      "Rune Gate.",
      "Go again.",
      "Blood debt.",
      "Note: Unsure whether the Gate is optional.",
    ]);
  });

  it("describes nothing for a plain card", () => {
    expect(describeAttributes(generated)).toEqual([]);
  });
});

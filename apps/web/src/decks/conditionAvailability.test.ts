// Condition availability (README "Deck analysis", phase two step 7): each condition a deck's
// cards record becomes a built-in scenario. With the card in hand, is what the condition needs
// in the opening hand too?
import { scenarioSchema } from "@vdb/engine";
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { availabilityScenarios } from "./conditionAvailability.ts";
import type { DeckEntry } from "./deckRules.ts";

const byName = (name: string) => sampleCards.find((c) => c.name === name)!;
const entry = (card: CardSummary, quantity = 2): DeckEntry => ({
  card,
  variant: card.variants[0]!,
  quantity,
  sideboard: false,
});

describe("availabilityScenarios", () => {
  it("turns a banished-card condition into: the card in hand, and another to banish", () => {
    const { scenarios } = availabilityScenarios([
      entry(byName("Become the Shadow Lord")),
    ]);
    const shadow = scenarios.find(
      (s) => s.condition === "banished_card_is_shadow",
    )!;
    expect(shadow.cardName).toBe("Become the Shadow Lord");
    expect(shadow.plain).toBe("the banished card is Shadow");
    expect(shadow.needs).toBe("another Shadow card in hand to banish");
    expect(scenarioSchema.parse(shadow.definition)).toMatchObject({
      horizon: 0,
      access: ["hand"],
      fixed: [{ name: "Become the Shadow Lord", zone: "hand" }],
      // It's Shadow itself, so a second Shadow card.
      condition: { any: [{ filter: { trait: "shadow" }, min: 2 }] },
    });
  });

  it("needs only one matching card when the card itself doesn't match", () => {
    const action: CardSummary = {
      ...byName("Become the Shadow Lord"),
      id: "card-x",
      name: "Pitch Test",
      type: "action",
      talents: [],
      attributes: {
        ...byName("Become the Shadow Lord").attributes,
        banishesOwn: [],
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "on_play",
            conditions: ["pitched_attack_action"],
          },
        ],
      },
    };
    const { scenarios } = availabilityScenarios([entry(action)]);
    expect(scenarios[0]!.definition.condition).toEqual({
      any: [
        {
          label: "another attack action card in hand to pitch",
          filter: { type: "attack_action" },
          min: 1,
        },
      ],
    });
  });

  it("lists conditions a hand can't show, rather than guessing", () => {
    const life: CardSummary = {
      ...byName("Become the Shadow Lord"),
      id: "card-y",
      name: "Life Test",
      attributes: {
        ...byName("Become the Shadow Lord").attributes,
        banishesOwn: [],
        tokens: [
          {
            token: "runechant",
            amount: 1,
            trigger: "on_play",
            conditions: ["hero_lost_life_this_turn"],
          },
        ],
      },
    };
    const { scenarios, notMeasured } = availabilityScenarios([entry(life)]);
    expect(scenarios).toEqual([]);
    expect(notMeasured).toEqual([
      { cardName: "Life Test", plain: "a hero has lost life this turn" },
    ]);
  });

  it("leaves out the sideboard, and does each card once across its pitches", () => {
    const bsl = byName("Become the Shadow Lord");
    const { scenarios } = availabilityScenarios([
      entry(bsl),
      entry(bsl),
      { ...entry(bsl), sideboard: true },
    ]);
    expect(scenarios.map((s) => s.condition)).toEqual([
      "banished_card_is_runeblade",
      "banished_card_is_shadow",
    ]);
  });
});

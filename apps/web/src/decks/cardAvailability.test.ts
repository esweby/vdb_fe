// Condition availability in the deck's card list (README "Deck builder"): each card's
// availability from the condition scenarios, and sorting and filtering the list by it.
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import type { OneOutput } from "../ranking/scenarioRuns.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import {
  availabilityByCard,
  RARELY_BELOW,
  rarelyAvailable,
  sortByAvailability,
} from "./cardAvailability.ts";
import {
  availabilityScenarios,
  type AvailabilityScenario,
} from "./conditionAvailability.ts";
import type { DeckEntry } from "./deckRules.ts";

const byName = (name: string) => sampleCards.find((c) => c.name === name)!;
const entry = (card: CardSummary, quantity = 2): DeckEntry => ({
  card,
  variant: card.variants[0]!,
  quantity,
  sideboard: false,
});
const scenario = (
  cardId: string,
  plain: string,
): Pick<AvailabilityScenario, "cardId" | "plain" | "needs"> => ({
  cardId,
  plain,
  needs: `needs for ${plain}`,
});
const output = (successRate: number | null): OneOutput => ({
  ...(successRate === null
    ? { error: "Can't run" }
    : { result: { successRate } as OneOutput["result"] & object }),
  deck: { deckSize: 60, coreCards: 6, blanks: 54 },
  runs: 100,
  seed: 1,
});

describe("availabilityScenarios", () => {
  it("records which card each scenario is for", () => {
    const { scenarios } = availabilityScenarios([
      entry(byName("Become the Shadow Lord")),
    ]);
    expect(scenarios.map((s) => s.cardId)).toEqual([
      "card-become-the-shadow-lord",
      "card-become-the-shadow-lord",
    ]);
  });
});

describe("availabilityByCard", () => {
  it("gives a card the lowest of its conditions, and keeps each one", () => {
    const byCard = availabilityByCard(
      [scenario("a", "first"), scenario("a", "second"), scenario("b", "only")],
      [output(0.6), output(0.2), output(0.9)],
    );
    expect(byCard.get("a")).toEqual({
      rate: 0.2,
      conditions: [
        { plain: "first", needs: "needs for first", rate: 0.6 },
        { plain: "second", needs: "needs for second", rate: 0.2 },
      ],
    });
    expect(byCard.get("b")?.rate).toBe(0.9);
  });

  it("leaves out a condition that couldn't run, and a card with none that ran", () => {
    const byCard = availabilityByCard(
      [scenario("a", "ran"), scenario("a", "failed"), scenario("b", "failed")],
      [output(0.5), output(null), output(null)],
    );
    expect(byCard.get("a")?.conditions.map((c) => c.plain)).toEqual(["ran"]);
    expect(byCard.has("b")).toBe(false);
  });
});

describe("sorting and filtering by availability", () => {
  const hocus = entry(byName("Hocus Pocus"));
  const bsl = entry(byName("Become the Shadow Lord"));
  const fate = entry(byName("Fate Foreseen"));
  const other: DeckEntry = {
    ...entry({ ...byName("Become the Shadow Lord"), id: "card-other" }),
  };
  const byCard = availabilityByCard(
    [scenario("card-become-the-shadow-lord", "x"), scenario("card-other", "y")],
    [output(0.4), output(0.1)],
  );

  it("puts the least available first, then cards with nothing measured by name", () => {
    expect(
      sortByAvailability([hocus, fate, bsl, other], byCard).map(
        (e) => e.card.id,
      ),
    ).toEqual([
      "card-other",
      "card-become-the-shadow-lord",
      "card-fate-foreseen",
      "card-hocus-pocus",
    ]);
  });

  it("keeps only the cards whose condition is rarely available", () => {
    expect(RARELY_BELOW).toBe(0.25);
    expect(
      rarelyAvailable([hocus, bsl, other], byCard).map((e) => e.card.id),
    ).toEqual(["card-other"]);
  });
});

import { describe, expect, it } from "vitest";
import type { CardSummary } from "./cardRepository.ts";
import { classOf, filterCards, type CardFilters } from "./filterCards.ts";

const card = (over: Partial<CardSummary>): CardSummary => ({
  id: over.name ?? "x",
  name: "x",
  type: "action",
  subtypes: [],
  classes: ["Runeblade"],
  talents: [],
  variants: [{ id: "v", pitch: 1, cost: 0, power: null, defense: 3 }],
  ...over,
});

const cards = [
  card({
    name: "Hocus Pocus",
    type: "attack_action",
    variants: [1, 2, 3].map((p) => ({
      id: `h${p}`,
      pitch: p,
      cost: 0,
      power: 3,
      defense: 3,
    })),
  }),
  card({
    name: "Become the Shadow Lord",
    talents: ["Shadow"],
    variants: [{ id: "b3", pitch: 3, cost: 0, power: null, defense: 3 }],
  }),
  card({
    name: "Fate Foreseen",
    type: "defense_reaction",
    classes: ["Generic"],
  }),
  card({
    name: "Nebula Blade",
    type: "weapon",
    variants: [{ id: "n", pitch: null, cost: null, power: 1, defense: null }],
  }),
];
const none: CardFilters = {
  search: "",
  pitches: [],
  type: null,
  cardClass: null,
  sort: "name",
};
const names = (f: Partial<CardFilters>) =>
  filterCards(cards, { ...none, ...f }).map((c) => c.name);

describe("filterCards", () => {
  it("sorts by name by default", () => {
    expect(names({})).toEqual([
      "Become the Shadow Lord",
      "Fate Foreseen",
      "Hocus Pocus",
      "Nebula Blade",
    ]);
  });

  it("searches names, ignoring case", () => {
    expect(names({ search: "shadow" })).toEqual(["Become the Shadow Lord"]);
  });

  it("filters by pitch: a card matches if any variant has that pitch", () => {
    expect(names({ pitches: [3] })).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus",
    ]);
    expect(names({ pitches: [1, 3] })).toEqual([
      "Become the Shadow Lord",
      "Fate Foreseen",
      "Hocus Pocus",
    ]);
  });

  it("filters by type", () => {
    expect(names({ type: "weapon" })).toEqual(["Nebula Blade"]);
  });

  it("filters by class, treating the Shadow talent as Shadow", () => {
    expect(names({ cardClass: "Shadow" })).toEqual(["Become the Shadow Lord"]);
    expect(names({ cardClass: "Generic" })).toEqual(["Fate Foreseen"]);
    expect(names({ cardClass: "Runeblade" })).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus",
      "Nebula Blade",
    ]);
  });

  it("sorts by type, then name", () => {
    expect(names({ sort: "type" })).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus",
      "Fate Foreseen",
      "Nebula Blade",
    ]);
  });

  it("combines filters", () => {
    expect(
      names({ cardClass: "Runeblade", pitches: [1], search: "o" }),
    ).toEqual(["Hocus Pocus"]);
  });

  it("describes a card's class for display", () => {
    expect(classOf(cards[1]!)).toBe("Shadow Runeblade");
    expect(classOf(cards[2]!)).toBe("Generic");
  });
});

import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { analyseDeck } from "./deckAnalysis.ts";
import type { DeckEntry } from "./deckRules.ts";

const dimensions = [
  { id: 1, key: "runechantCreation", label: "Runechant creation" },
  { id: 2, key: "gateCreation", label: "Gate creation" },
];

const entry = (
  id: string,
  pitch: number | null,
  quantity: number,
  options: { type?: string; cost?: number | null; sideboard?: boolean } = {},
): DeckEntry => {
  const variant = {
    id,
    pitch,
    cost: options.cost === undefined ? 1 : options.cost,
    power: null,
    defense: 3,
    attributes: {},
  };
  const card = {
    id: `card-${id}`,
    name: id,
    type: options.type ?? "action",
    subtypes: options.type === "weapon" ? ["Sword", "2H"] : [],
    classes: ["Runeblade"],
    talents: [],
    keywords: [],
    attributes: {} as CardSummary["attributes"],
    attributesVerified: true,
    variants: [variant],
  };
  return { card, variant, quantity, sideboard: options.sideboard ?? false };
};

const scores = new Map([
  ["red", { runechantCreation: 90, gateCreation: 0 }],
  ["blue", { runechantCreation: 50, gateCreation: 80 }],
  ["blade", { runechantCreation: 40, gateCreation: 0 }],
]);

describe("analyseDeck", () => {
  const entries = [
    entry("red", 1, 3, { cost: 0 }),
    entry("blue", 3, 2, { cost: 2 }),
    entry("unscored", 2, 1, { cost: 4 }),
    entry("side", 1, 3, { sideboard: true }),
    entry("blade", null, 1, { type: "weapon", cost: null }),
  ];
  const analysis = analyseDeck({ entries, dimensions, scores });

  it("counts deck cards by pitch, leaving out the sideboard and gear", () => {
    expect(analysis.pitch).toEqual({ 1: 3, 2: 1, 3: 2, 4: 0 });
  });

  it("builds a cost curve from deck cards", () => {
    expect(analysis.costCurve).toEqual({ "0": 3, "1": 0, "2": 2, "3+": 1 });
  });

  it("totals each dimension by pitch, with weapons and equipment as always available", () => {
    expect(analysis.dimensions).toEqual([
      {
        key: "runechantCreation",
        label: "Runechant creation",
        cards: 5,
        byPitch: { 1: 3, 2: 0, 3: 2, 4: 0 },
        average: 74,
        alwaysAvailable: 1,
      },
      {
        key: "gateCreation",
        label: "Gate creation",
        cards: 2,
        byPitch: { 1: 0, 2: 0, 3: 2, 4: 0 },
        average: 80,
        alwaysAvailable: 0,
      },
    ]);
  });

  it("gives an overview: average cost and pitch, resource surplus, go again and attacks", () => {
    expect(analysis.overview).toEqual({
      cards: 6,
      averageCost: 1.33,
      averagePitch: 1.83,
      resourceSurplus: 0.5,
      goAgain: 0,
      attacks: 0,
    });
  });

  it("counts deck cards nobody has scored", () => {
    expect(analysis.unscored).toBe(1);
  });

  it("counts purple (pitch 4) cards, and scores them by pitch", () => {
    const withSoul = analyseDeck({
      entries: [
        ...entries,
        entry("soul", 4, 1, { type: "resource", cost: null }),
      ],
      dimensions,
      scores: new Map([
        ...scores,
        ["soul", { runechantCreation: 10, gateCreation: 0 }],
      ]),
    });
    expect(withSoul.pitch).toEqual({ 1: 3, 2: 1, 3: 2, 4: 1 });
    expect(withSoul.dimensions[0]!.byPitch).toEqual({ 1: 3, 2: 0, 3: 2, 4: 1 });
  });
});

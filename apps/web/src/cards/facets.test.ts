import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { applyFilters } from "../filters/applyFilters.ts";
import { cardFacets } from "./facets.ts";

const facets = cardFacets({ reviewedCardIds: new Set(["card-hocus-pocus"]) });
const names = (state: Parameters<typeof applyFilters>[2]) =>
  applyFilters(sampleCards, facets, state)
    .map((c) => c.name)
    .sort();

describe("card facets", () => {
  it("filters by keyword, including conditional and granted go again", () => {
    expect(names({ keywords: { go_again: "include" } })).toEqual([
      "Become the Shadow Lord",
    ]);
  });

  it("finds token creators, including per-pitch tokens", () => {
    expect(names({ creates: { runechant: "include" } })).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus",
    ]);
  });

  it("filters by pitch, class and type", () => {
    expect(
      names({ pitch: { "3": "include" }, class: { Shadow: "include" } }),
    ).toEqual(["Become the Shadow Lord"]);
    expect(names({ type: { weapon: "include" } })).toEqual(["Nebula Blade"]);
  });

  it("filters by tags and banish routes", () => {
    expect(names({ tags: { can_attack: "include" } })).toEqual([
      "Nebula Blade",
    ]);
    expect(names({ banish: { gate: "include" } })).toEqual(["Hocus Pocus"]);
  });

  it("filters by my review status", () => {
    expect(names({ status: { reviewed: "exclude" } })).toEqual([
      "Become the Shadow Lord",
      "Fate Foreseen",
      "Nebula Blade",
    ]);
  });
});

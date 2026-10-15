import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { applyFilters } from "../filters/applyFilters.ts";
import { onlyState } from "../filters/FilterSidebar.tsx";
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

  it("filters by pitch (including pitch 4 and no pitch), class and type", () => {
    expect(
      names({ pitch: { "1": "exclude", "2": "exclude", none: "exclude" } }),
    ).toEqual(["Become the Shadow Lord", "Fate Foreseen", "Hocus Pocus"]);
    expect(
      facets.find((f) => f.id === "pitch")?.values.map((v) => v.label),
    ).toEqual(["Red", "Yellow", "Blue", "Pitch 4", "No pitch"]);
    expect(
      names({ pitch: { "3": "include" }, class: { Shadow: "include" } }),
    ).toEqual(["Become the Shadow Lord"]);
    expect(names({ type: { weapon: "include" } })).toEqual(["Nebula Blade"]);
    // Attack and defense reactions are one "Reactions" line
    expect(names({ type: { reaction: "exclude" } })).not.toContain(
      "Fate Foreseen",
    );
  });

  it("puts pitch and class in the top bar, and mechanics in a collapsed section", () => {
    const where = (id: string) => facets.find((f) => f.id === id);
    expect(where("pitch")?.placement).toBe("bar");
    expect(where("class")?.placement).toBe("bar");
    expect(where("type")?.placement ?? "side").toBe("side");
    for (const id of ["keywords", "creates", "banish", "tags", "disrupts"]) {
      expect(where(id)).toMatchObject({
        kind: "feature",
        section: "Mechanics",
      });
    }
    expect(where("cost")).toBeUndefined();
  });

  it("filters by tags and banish routes", () => {
    expect(names({ tags: { can_attack: "include" } })).toEqual([
      "Nebula Blade",
    ]);
    expect(names({ banish: { gate: "include" } })).toEqual(["Hocus Pocus"]);
  });

  it("filters by my review status", () => {
    expect(names({ reviewed: { reviewed: "exclude" } })).toEqual([
      "Become the Shadow Lord",
      "Fate Foreseen",
      "Nebula Blade",
    ]);
  });

  it("filters by power and defense bands, hiding a card only when every pitch is unticked", () => {
    // Nebula Blade has power 1; Hocus Pocus has 4, 3 and 2; actions without power stay.
    expect(names({ power: { "0-1": "exclude" } })).toEqual([
      "Become the Shadow Lord",
      "Fate Foreseen",
      "Hocus Pocus",
    ]);
    expect(names({ defense: { ge3: "exclude" } })).toEqual(["Nebula Blade"]);
  });

  it("'Only' on an equipment slot shows just equipment in that slot, not weapons or actions", () => {
    const weapon = sampleCards.find((c) => c.type === "weapon")!;
    const gauntlets = {
      ...weapon,
      id: "arms",
      name: "Arms gear",
      type: "equipment",
      subtypes: ["Arms"],
    } as typeof weapon;
    const helm = {
      ...gauntlets,
      id: "head",
      name: "Head gear",
      subtypes: ["Head"],
    };
    const slot = facets.find((f) => f.id === "slot")!;
    const state = onlyState(slot, {}, "Arms");
    expect(
      applyFilters([...sampleCards, gauntlets, helm], facets, state).map(
        (c) => c.name,
      ),
    ).toEqual(["Arms gear"]);
  });
});

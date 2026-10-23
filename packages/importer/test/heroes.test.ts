// Matchups need the heroes a deck can face: every adult hero playable in Classic Constructed.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DatasetCard } from "../src/classify.ts";
import { toHeroes } from "../src/map.ts";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/cards.json", import.meta.url), "utf8"),
) as DatasetCard[];

describe("toHeroes", () => {
  it("keeps adult heroes playable in Classic Constructed, with their classes and talents", () => {
    expect(toHeroes(fixture)).toEqual([
      {
        externalId: expect.any(String),
        name: "Viserai, the Forsaken",
        classes: ["Runeblade"],
        talents: ["Shadow"],
        imageUrl: null,
      },
    ]);
  });

  it("leaves out young heroes, which are for Blitz", () => {
    expect(toHeroes(fixture).map((h) => h.name)).not.toContain("Viserai");
  });

  it("leaves out Arakni, Marionette, a Living Legend since 19 Oct 2026 (ahead of the dataset)", () => {
    const marionette = {
      ...fixture.find((c) => c.name === "Viserai, the Forsaken")!,
      name: "Arakni, Marionette",
      types: ["Chaos", "Assassin", "Hero"],
    };
    expect(toHeroes([...fixture, marionette]).map((h) => h.name)).toEqual([
      "Viserai, the Forsaken",
    ]);
  });

  it.each([
    "Arakni, Marionette",
    "Aurora, Shooting Star",
    "Azalea, Ace in the Hole",
    "Bravo, Star of the Show",
    "Briar, Warden of Thorns",
    "Chane, Bound by Shadow",
    "Dash I/O",
    "Dash, Inventor Extraordinaire",
    "Dromai, Ash Artist",
    "Enigma, Ledger of Ancestry",
    "Fai, Rising Rebellion",
    "Florian, Rotwood Harbinger",
    "Iyslander, Stormbind",
    "Kayo, Armed and Dangerous",
    "Kano, Dracai of Aether",
    "Kassai of the Golden Sand",
    "Lexi, Livewire",
    "Nuu, Alluring Desire",
    "Oldhim, Grandfather of Eternity",
    "Oscilio, Constella Intelligence",
    "Prism, Awakener of Sol",
    "Prism, Sculptor of Arc Light",
    "Verdance, Thorn of the Rose",
    "Victor Goldmane, High and Mighty",
    "Viserai, Rune Blood",
    "Zen, Tamer of Purpose",
  ])("leaves out %s, a Living Legend (the maintainer, 21 Oct 2026)", (name) => {
    const hero = {
      ...fixture.find((c) => c.name === "Viserai, the Forsaken")!,
      name,
    };
    expect(toHeroes([...fixture, hero]).map((h) => h.name)).toEqual([
      "Viserai, the Forsaken",
    ]);
  });
});

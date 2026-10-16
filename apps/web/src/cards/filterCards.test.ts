import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { classOf, searchAndSort, statText } from "./filterCards.ts";

const names = (
  search: string,
  sort: Parameters<typeof searchAndSort>[2] = "name",
) => searchAndSort(sampleCards, search, sort).map((c) => c.name);

describe("searchAndSort", () => {
  it("sorts by name by default", () => {
    expect(names("")).toEqual([
      "Become the Shadow Lord",
      "Fate Foreseen",
      "Hocus Pocus",
      "Nebula Blade",
    ]);
  });

  it("searches names, ignoring case", () => {
    expect(names("shadow")).toEqual(["Become the Shadow Lord"]);
  });

  // The same search as Add cards in the deck builder, so "usurp" finds the same cards in both.
  it("searches keywords and the type line as well as names", () => {
    expect(names("blood debt")).toEqual(["Hocus Pocus"]);
    expect(names("GO AGAIN")).toEqual(["Become the Shadow Lord"]);
    expect(names("weapon")).toEqual(["Nebula Blade"]);
  });

  it("sorts by type, then name", () => {
    expect(names("", "type")).toEqual([
      "Become the Shadow Lord",
      "Hocus Pocus",
      "Fate Foreseen",
      "Nebula Blade",
    ]);
  });

  it("describes a card's class for display", () => {
    expect(classOf(sampleCards[1]!)).toBe("Shadow Runeblade");
    expect(classOf(sampleCards[2]!)).toBe("Generic");
  });

  it("sorts by power (highest first), defense (highest first) and cost (cheapest first), stat-less cards last", () => {
    // Hocus Pocus power 4/3/2, Nebula Blade 1, others none
    expect(names("", "power")).toEqual([
      "Hocus Pocus",
      "Nebula Blade",
      "Become the Shadow Lord",
      "Fate Foreseen",
    ]);
    expect(names("", "defense").slice(-1)).toEqual(["Nebula Blade"]);
    expect(names("", "cost").slice(-1)).toEqual(["Nebula Blade"]);
  });
});

describe("statText", () => {
  it("shows one value when every pitch agrees, each pitch's value when they differ", () => {
    expect(statText(sampleCards[0]!, "power")).toBe("4 / 3 / 2");
    expect(statText(sampleCards[0]!, "defense")).toBe("3");
    expect(statText(sampleCards[3]!, "defense")).toBe("–");
  });
});

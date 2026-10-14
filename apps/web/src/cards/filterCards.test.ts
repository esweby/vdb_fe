import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { classOf, searchAndSort } from "./filterCards.ts";

const names = (search: string, sort: "name" | "type" = "name") =>
  searchAndSort(sampleCards, search, sort).map((c) => c.name);

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
});

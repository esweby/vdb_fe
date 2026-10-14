import { describe, expect, it } from "vitest";
import {
  applyFilters,
  facetCounts,
  type Facet,
  type FilterState,
} from "./applyFilters.ts";

type Card = { name: string; type: string; tags: string[] };
const cards: Card[] = [
  { name: "A", type: "action", tags: ["go", "debt"] },
  { name: "B", type: "action", tags: ["go"] },
  { name: "C", type: "instant", tags: ["debt"] },
  { name: "D", type: "weapon", tags: [] },
];
const facets: Facet<Card>[] = [
  {
    id: "type",
    label: "Type",
    mode: "any",
    values: ["action", "instant", "weapon"].map((t) => ({
      id: t,
      label: t,
      test: (c: Card) => c.type === t,
    })),
  },
  {
    id: "tags",
    label: "Tags",
    mode: "all",
    values: ["go", "debt"].map((t) => ({
      id: t,
      label: t,
      test: (c: Card) => c.tags.includes(t),
    })),
  },
];
const names = (state: FilterState) =>
  applyFilters(cards, facets, state).map((c) => c.name);

describe("applyFilters", () => {
  it("does nothing with no filters", () => {
    expect(names({})).toEqual(["A", "B", "C", "D"]);
  });

  it("ANY groups: an included value matches if any is true", () => {
    expect(names({ type: { action: "include", instant: "include" } })).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("ALL groups: every included value must be true", () => {
    expect(names({ tags: { go: "include", debt: "include" } })).toEqual(["A"]);
    expect(names({ tags: { go: "include" } })).toEqual(["A", "B"]);
  });

  it("excludes always remove, in either kind of group", () => {
    expect(names({ tags: { debt: "exclude" } })).toEqual(["B", "D"]);
    expect(names({ type: { weapon: "exclude" } })).toEqual(["A", "B", "C"]);
  });

  it("combines groups with AND", () => {
    expect(
      names({ type: { action: "include" }, tags: { debt: "exclude" } }),
    ).toEqual(["B"]);
  });

  it("ignores unknown groups and values (old URLs)", () => {
    expect(
      names({ nope: { x: "include" }, type: { gone: "include" } }),
    ).toEqual(["A", "B", "C", "D"]);
  });
});

describe("facetCounts", () => {
  it("counts each value against the other groups' filters", () => {
    const counts = facetCounts(cards, facets, { tags: { go: "include" } });
    // A value's count is the number of results you'd get by adding it.
    expect(counts.type).toEqual({ action: 2, instant: 0, weapon: 0 });
    // ALL group: adding "debt" to the included "go" leaves only A.
    expect(counts.tags).toEqual({ go: 2, debt: 1 });
  });

  it("ANY groups count each value without the group's own includes", () => {
    const counts = facetCounts(cards, facets, { type: { action: "include" } });
    expect(counts.type).toEqual({ action: 2, instant: 1, weapon: 1 });
  });
});

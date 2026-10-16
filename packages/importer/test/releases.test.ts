// When a card first came out, for the Needs review order (newest first): the earliest release
// among the sets it was printed in, so a reprint doesn't make an old card look new.
import { describe, expect, it } from "vitest";
import type { DatasetCard } from "../src/classify.ts";
import { firstRelease, setReleases, type DatasetSet } from "../src/releases.ts";
import { toImportCards } from "../src/map.ts";
import fixture from "./fixtures/cards.json" with { type: "json" };

const sets: DatasetSet[] = [
  {
    id: "WTR",
    name: "Welcome to Rathe",
    printings: [
      { edition: "A", initial_release_date: "2019-10-11T00:00:00.000Z" },
      { edition: "U", initial_release_date: "2020-11-06T00:00:00.000Z" },
    ],
  },
  {
    id: "IAR",
    name: "Usurp the Shadow Throne",
    printings: [
      { edition: "N", initial_release_date: "2026-09-25T00:00:00.000Z" },
    ],
  },
  { id: "LGS", name: "Promos", printings: [{ edition: "N" }] },
];

describe("set releases", () => {
  it("dates each set by its first edition, ignoring sets without a date", () => {
    const releases = setReleases(sets);
    expect(releases.get("WTR")).toEqual({
      name: "Welcome to Rathe",
      released: "2019-10-11",
    });
    expect(releases.get("LGS")).toBeUndefined();
  });

  it("dates a card by the earliest set it was printed in", () => {
    const releases = setReleases(sets);
    expect(firstRelease(["IAR", "LGS", "WTR"], releases)).toEqual({
      name: "Welcome to Rathe",
      released: "2019-10-11",
    });
    expect(firstRelease(["LGS"], releases)).toBeNull();
  });

  it("gives each imported card its first release", () => {
    const entries = (fixture as DatasetCard[]).map((e) =>
      e.name === "Become the Shadow Lord"
        ? { ...e, printings: [{ set_id: "IAR" }] }
        : e,
    );
    const cards = toImportCards(entries, {}, setReleases(sets));
    expect(
      cards.find((c) => c.name === "Become the Shadow Lord")?.firstRelease,
    ).toEqual({ name: "Usurp the Shadow Throne", released: "2026-09-25" });
    expect(cards.find((c) => c.name === "Abyssal Bite")?.firstRelease).toBe(
      null,
    );
  });
});

import { authoredAttributesSchema } from "@vdb/cards";
import { describe, expect, it } from "vitest";
import { allAuthored, batches } from "../src/authored/index.ts";

describe("authored batches", () => {
  it("has no card in more than one batch", () => {
    expect(() => allAuthored()).not.toThrow();
  });

  for (const [batch, entries] of Object.entries(batches)) {
    describe(batch, () => {
      for (const [name, entry] of Object.entries(entries)) {
        it(`${name} matches the vocabulary`, () => {
          if (entry.card)
            expect(authoredAttributesSchema.parse(entry.card)).toBeTruthy();
          for (const v of Object.values(entry.variants ?? {})) {
            expect(authoredAttributesSchema.parse(v)).toBeTruthy();
          }
        });
      }
    });
  }

  it("includes batch 1, Runechant creators", () => {
    expect(Object.keys(batches)).toContain("01-runechant-creators");
  });

  it("includes batch 2, Gate creators", () => {
    expect(Object.keys(batches)).toContain("02-gate-creators");
  });

  it("includes batch 3, blood debt and banish", () => {
    expect(Object.keys(batches)).toContain("03-blood-debt-and-banish");
  });

  it("includes batch 5, the remaining cards", () => {
    expect(Object.keys(batches)).toContain("05-remaining");
  });

  it("includes batch 4, weapons and equipment", () => {
    expect(Object.keys(batches)).toContain("04-weapons-and-equipment");
  });

  it("links Base of the Mountain to cards that trigger when banished", () => {
    expect(
      batches["04-weapons-and-equipment"]!["Base of the Mountain"]?.card
        ?.supports,
    ).toEqual([{ target: { group: "triggers_when_banished" } }]);
  });
});

// Reported by the scoring group, 16 Oct 2026: the pre-release data gave Shadowrealm Walker
// Shadowrealm Ripper's text. The corrected text: banish a card from hand when it attacks; if
// it's Shadow, create a Gate to i'Arathael token. Unverified until the maintainer checks it.
describe("corrected cards", () => {
  it("Shadowrealm Walker creates a Gate, rather than gaining power, and awaits a check", () => {
    const walker = allAuthored()["Shadowrealm Walker"]!;
    expect(walker.verified).toBe(false);
    expect(walker.card?.tokens).toEqual([
      {
        token: "gate",
        amount: 1,
        trigger: "on_attack",
        conditions: ["banished_card_is_shadow"],
      },
    ]);
    expect(walker.card?.conditionalBonuses).toBeUndefined();
  });

  it("Darkest Hour's note matches the corrected blue (+2)", () => {
    expect(allAuthored()["Darkest Hour"]!.card?.notes).toContain("+4/+3/+2");
  });
});

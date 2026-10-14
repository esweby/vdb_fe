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
});

// README "Reproducibility": every saved result records its inputs, and a re-run says which
// differ, so old and new numbers aren't compared as like for like.
import { describe, expect, it } from "vitest";
import { differences } from "./results.ts";

const inputs = {
  deckSnapshot: ["hp1×3", "nb×1"],
  definition: { version: 1, name: "A" },
  definitionVersion: 1,
  runs: 10_000,
  engineVersion: "0.1.0",
};

describe("differences", () => {
  it("is empty when every input is the same", () => {
    expect(differences(inputs, { ...inputs })).toEqual([]);
  });

  it("ignores key order, which the database doesn't keep", () => {
    expect(
      differences(
        { ...inputs, definition: { name: "A", version: 1 } },
        { ...inputs },
      ),
    ).toEqual([]);
  });

  it("names each input that changed", () => {
    expect(
      differences(inputs, {
        ...inputs,
        deckSnapshot: ["hp1×2", "nb×1"],
        definition: { version: 1, name: "B" },
        engineVersion: "0.2.0",
        runs: 5_000,
      }),
    ).toEqual(["the deck", "the scenario", "the number of runs", "the engine"]);
  });
});

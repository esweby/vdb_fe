// Engine calibration (docs/engine-calibration.md): a deck list as the rules engine plays it, with
// how much of it plays by verified rules. Unverified cards make the simulation incomplete.
import { describe, expect, it } from "vitest";
import { sampleCards, TEST_POCUS } from "../test/fakeCardRepository.ts";
import { resolveDeck } from "./resolveDeck.ts";

const cards = [...sampleCards, TEST_POCUS];

describe("resolveDeck", () => {
  it("counts the approved final pair as modelled and overrides stale Scar go again", () => {
    const pair = ["Cull", "Scar for a Scar"].map((name) => ({
      ...sampleCards[0]!,
      name,
      type: name === "Cull" ? "action" : "attack_action",
      attributes: {
        ...sampleCards[0]!.attributes,
        hasGoAgain: name === "Scar for a Scar",
      },
      variants: [{ ...sampleCards[0]!.variants[0]!, pitch: 1, cost: 0 }],
    }));
    const resolved = resolveDeck(
      pair.map((source) => ({ name: source.name, pitch: 1, copies: 2 })),
      pair,
    );
    expect(resolved.coverage).toEqual({
      copies: { modelled: 4, total: 4 },
      distinct: { modelled: 2, total: 2 },
      unmodelled: [],
    });
    expect(
      resolved.deck.find((source) => source.name === "Scar for a Scar")!
        .goAgain,
    ).toBe(false);
  });
  it("puts weapons in their slot and copies in the deck", () => {
    const r = resolveDeck(
      [
        { copies: 3, name: "Become the Shadow Lord", pitch: 3 },
        { copies: 1, name: "Nebula Blade", pitch: null },
      ],
      cards,
    );
    expect(r.deck.map((c) => c.name)).toEqual(
      Array(3).fill("Become the Shadow Lord"),
    );
    expect(r.weapons.map((c) => c.name)).toEqual(["Nebula Blade"]);
    expect(r.missing).toEqual([]);
  });

  it("reports coverage by distinct card and by copy", () => {
    const r = resolveDeck(
      [
        { copies: 3, name: "Become the Shadow Lord", pitch: 3 },
        { copies: 2, name: "Test Pocus", pitch: 1 },
      ],
      cards,
    );
    expect(r.coverage).toEqual({
      copies: { modelled: 3, total: 5 },
      distinct: { modelled: 1, total: 2 },
      unmodelled: ["Test Pocus (red)"],
    });
  });

  it("lists names or pitches it can't find", () => {
    const r = resolveDeck(
      [
        { copies: 1, name: "No Such Card", pitch: 1 },
        { copies: 1, name: "Become the Shadow Lord", pitch: 1 },
      ],
      cards,
    );
    expect(r.missing).toEqual([
      "No Such Card (red)",
      "Become the Shadow Lord (red)",
    ]);
    expect(r.deck).toEqual([]);
  });
});

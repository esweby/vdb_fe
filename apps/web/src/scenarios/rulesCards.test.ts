// Step 7b (docs/rules-engine.md): the app's cards as the rules engine sees them.
import { describe, expect, it } from "vitest";
import { sampleCards, TEST_POCUS } from "../test/fakeCardRepository.ts";
import { rulesCardOf } from "./rulesCards.ts";

const byName = (name: string) => sampleCards.find((c) => c.name === name)!;

describe("rulesCardOf", () => {
  it("adds the variant's cost, natural go again and the card's verified rules", () => {
    const bsl = byName("Become the Shadow Lord");
    const card = rulesCardOf(bsl, bsl.variants[0]!);
    expect(card).toMatchObject({
      name: "Become the Shadow Lord",
      cost: 0,
      pitch: 3,
      goAgain: true,
    });
    expect(card.effects).toBeDefined();
  });

  it("carries the variant's printed power, for threatened damage", () => {
    const attack = sampleCards.find((c) =>
      c.variants.some((v) => (v.power ?? 0) > 0),
    )!;
    const variant = attack.variants.find((v) => (v.power ?? 0) > 0)!;
    expect(rulesCardOf(attack, variant).power).toBe(variant.power);
  });

  it("leaves a card with no verified rules unmodelled", () => {
    // Hocus Pocus is verified now (20 Oct 2026); its unverified copy isn't.
    expect(
      rulesCardOf(TEST_POCUS, TEST_POCUS.variants[0]!).effects,
    ).toBeUndefined();
  });
});

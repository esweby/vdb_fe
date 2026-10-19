// Step 7b (docs/rules-engine.md): the app's cards as the rules engine sees them.
import { describe, expect, it } from "vitest";
import { sampleCards } from "../test/fakeCardRepository.ts";
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

  it("leaves a card with no verified rules unmodelled", () => {
    const hp = byName("Hocus Pocus");
    expect(rulesCardOf(hp, hp.variants[0]!).effects).toBeUndefined();
  });
});

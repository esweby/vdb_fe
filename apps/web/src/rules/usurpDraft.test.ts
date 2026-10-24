// Usurp the Shadow Throne's draft, accepted by the maintainer on 24 Oct 2026.
import { describe, expect, it } from "vitest";
import { verifiedRulesFor } from "@vdb/engine/rules";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftEffects } from "./draftEffects.ts";
import { draftQueue } from "./draftQueue.ts";

const throne: CardSummary = {
  ...sampleCards[0]!,
  id: "usurp-the-shadow-throne",
  name: "Usurp the Shadow Throne",
  attributes: {
    ...sampleCards[0]!.attributes,
    tokens: [],
    banishesOwn: [],
    costReductions: [{ amount: 6, conditions: ["usurped_this_turn"] }],
    playableFromBanish: { conditions: ["usurped_this_turn"] },
    notes: "On-hit effects are outside the engine's scope.",
  },
  variants: [{ ...sampleCards[0]!.variants[0]!, pitch: 3, attributes: {} }],
};

describe("Usurp the Shadow Throne's draft", () => {
  it("matches the verified blue rules, with conditional permission and cost reduction", () => {
    const entry = draftQueue([throne])[0]!;
    expect(entry.status).toBe("verified");
    expect(entry.verified).toBe(true);
    const draft = entry.drafts[0]!.draft;
    expect(draft.notDrafted).toEqual([]);
    expect(draft.rules).toMatchObject({
      costReductions: [{ amount: 6, when: "usurpedThisTurn" }],
      playableFromBanishWhen: "usurpedThisTurn",
    });
    expect(draft.rules.playableFromBanish).toBeUndefined();
    expect(draft.description).toContain(
      "It can be played from the banished zone if you've usurped this turn.",
    );
    expect(verifiedRulesFor(throne.name, 3)).toEqual(draft.rules);
  });

  it("keeps other conditions and combinations incomplete", () => {
    for (const conditions of [
      ["played_non_attack_action_this_turn"],
      ["usurped_this_turn", "played_non_attack_action_this_turn"],
    ] as const) {
      const card: CardSummary = {
        ...throne,
        attributes: {
          ...throne.attributes,
          playableFromBanish: { conditions: [...conditions] },
        },
      };
      const draft = draftEffects(card, card.variants[0]!);
      expect(draft.complete).toBe(false);
      expect(draft.rules.playableFromBanish).toBeUndefined();
      expect(draft.rules.playableFromBanishWhen).toBeUndefined();
    }
  });
});

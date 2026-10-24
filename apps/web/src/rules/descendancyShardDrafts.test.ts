// Drafts matched to the blue rules approved by the maintainer on 24 Oct 2026.
import { describe, expect, it } from "vitest";
import { parseTriggers, verifiedRulesFor } from "@vdb/engine/rules";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";
import { draftEffects } from "./draftEffects.ts";

const descendant: CardSummary = {
  ...sampleCards[0]!,
  name: "Arknight Descendancy",
  attributes: {
    ...sampleCards[0]!.attributes,
    banishesOwn: [],
    tokens: [
      {
        token: "runechant",
        amount: "X",
        trigger: "on_banished",
        lifePaidUpTo: 3,
      },
    ],
    costReducedPerRunechant: true,
  },
  variants: [{ ...sampleCards[0]!.variants[0]!, pitch: 3, attributes: {} }],
};
const shard: CardSummary = {
  ...descendant,
  name: "Arknight Shard",
  attributes: {
    ...descendant.attributes,
    costReducedPerRunechant: false,
    tokens: [{ token: "runechant", amount: 1, trigger: "on_pitch" }],
  },
};

describe("the next Runechant draft pair", () => {
  it.each([descendant, shard])(
    "marks $name verified with rules matching the accepted draft",
    (card) => {
      const entry = draftQueue([card])[0]!;
      expect(entry.status).toBe("verified");
      expect(entry.verified).toBe(true);
      expect(entry.drafts[0]!.draft.notDrafted).toEqual([]);
      expect(() =>
        parseTriggers(entry.drafts[0]!.draft.rules.triggers),
      ).not.toThrow();
      expect(verifiedRulesFor(card.name, 3)).toEqual(
        entry.drafts[0]!.draft.rules,
      );
    },
  );

  it("describes Descendancy's life choice and retains its cost reduction", () => {
    const draft = draftEffects(descendant, descendant.variants[0]!);
    expect(draft.description).toContain(
      "When this is banished: pay up to 3 life to create that many Runechants (the player chooses).",
    );
    expect(draft.rules.costReductions).toEqual([{ amount: "perRunechant" }]);
  });

  it("keeps an unspecified X incomplete instead of guessing its meaning", () => {
    const card = {
      ...descendant,
      attributes: {
        ...descendant.attributes,
        tokens: [
          {
            token: "runechant" as const,
            amount: "X" as const,
            trigger: "on_banished" as const,
          },
        ],
      },
    };
    expect(draftEffects(card, card.variants[0]!).complete).toBe(false);
  });
});

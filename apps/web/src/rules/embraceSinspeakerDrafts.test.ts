// Drafts approved by the maintainer on 24 Oct 2026.
import { describe, expect, it } from "vitest";
import {
  parseEffects,
  parseTriggers,
  verifiedRulesFor,
} from "@esweby/fab-engine/rules";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";
import { draftEffects } from "./draftEffects.ts";

const embrace: CardSummary = {
  ...sampleCards[0]!,
  name: "Embrace Sin",
  type: "action",
  attributes: {
    ...sampleCards[0]!.attributes,
    hasUsurp: false,
    hasGoAgain: true,
    tokens: [],
    banishesOwn: [],
    enablesPlayFromBanish: [{ target: { group: "runechant_aura" } }],
    notes: "Your next attack this turn also gets +2 power.",
  },
  variants: [{ ...sampleCards[0]!.variants[0]!, pitch: 2, attributes: {} }],
};
const sinspeaker: CardSummary = {
  ...embrace,
  name: "Sinspeaker Gloomblade",
  type: "attack_action",
  attributes: {
    ...sampleCards[0]!.attributes,
    hasUsurp: true,
    hasGoAgain: false,
    tokens: [],
    banishesOwn: [],
    playableFromBanish: {},
    tutors: [
      {
        target: { group: "runechant_aura" },
        to: "arena",
        trigger: "on_attack",
        conditions: ["played_from_banish"],
        optional: true,
      },
    ],
  },
  variants: [{ ...sampleCards[0]!.variants[0]!, pitch: 1, attributes: {} }],
};

describe("Embrace and Sinspeaker's draft pair", () => {
  it.each([embrace, sinspeaker])(
    "marks $name verified with rules matching the accepted draft",
    (card) => {
      const entry = draftQueue([card])[0]!;
      expect(entry.status).toBe("verified");
      expect(entry.verified).toBe(true);
      const draft = entry.drafts[0]!.draft;
      expect(draft.notDrafted).toEqual([]);
      expect(() => parseEffects(draft.rules.effects)).not.toThrow();
      if (draft.rules.triggers)
        expect(() => parseTriggers(draft.rules.triggers)).not.toThrow();
      expect(verifiedRulesFor(card.name, card.variants[0]!.pitch)).toEqual(
        draft.rules,
      );
    },
  );

  it.each([
    ["Embrace Sin", 1],
    ["Embrace Sin", 3],
    ["Sinspeaker Gloomblade", 2],
    ["Sinspeaker Gloomblade", 3],
  ] as const)(
    "does not verify the unreviewed pitch of %s (%s)",
    (name, pitch) => {
      expect(verifiedRulesFor(name, pitch)).toBeUndefined();
    },
  );

  it("keeps Embrace's power bonus visible as an unmodelled fact", () => {
    expect(draftEffects(embrace, embrace.variants[0]!).factsNote).toContain(
      "+2 power",
    );
  });

  it("describes Sinspeaker's banish condition, optional search and shuffle", () => {
    const draft = draftEffects(sinspeaker, sinspeaker.variants[0]!);
    const text = draft.description.join(" ");
    expect(text).toContain("if this was played from the banished zone");
    expect(text).toContain("you may search");
    expect(text).toContain("shuffle");
  });

  it("leaves unsupported targets and conditions incomplete", () => {
    const card: CardSummary = {
      ...sinspeaker,
      attributes: {
        ...sinspeaker.attributes,
        tutors: [
          {
            target: { group: "runeblade_aura" },
            to: "hand",
            trigger: "on_play",
            optional: true,
          },
        ],
      },
    };
    expect(draftEffects(card, card.variants[0]!).complete).toBe(false);
  });
});

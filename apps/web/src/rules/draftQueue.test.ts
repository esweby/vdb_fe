// Step 9b (docs/rules-engine.md): the drafts a player checks, one per card, with pitches whose
// drafts match shown once. Cards with verified rules are marked, so they aren't checked twice.
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue } from "./draftQueue.ts";

const byName = (name: string) => sampleCards.find((c) => c.name === name)!;

describe("draftQueue", () => {
  it("leaves out cards whose facts give nothing to draft or note", () => {
    const names = draftQueue(sampleCards).map((e) => e.card.name);
    expect(names).not.toContain("Fate Foreseen");
    expect(names).not.toContain("Nebula Blade");
  });

  it("shows pitches with the same draft once", () => {
    const hocus = draftQueue([byName("Hocus Pocus")]);
    expect(hocus).toHaveLength(1);
    expect(hocus[0]!.drafts).toHaveLength(1);
    expect(hocus[0]!.drafts[0]!.pitches).toEqual([1, 2, 3]);
    expect(hocus[0]!.drafts[0]!.draft.description).toEqual([
      "When this attacks: create 1 Runechant.",
    ]);
  });

  it("keeps pitches apart when their drafts differ", () => {
    const hp = byName("Hocus Pocus");
    const card: CardSummary = {
      ...hp,
      variants: hp.variants.map((v) => ({
        ...v,
        attributes: {
          tokens: [
            {
              token: "runechant" as const,
              amount: 4 - v.pitch!,
              trigger: "on_play" as const,
            },
          ],
        },
      })),
    };
    expect(draftQueue([card])[0]!.drafts.map((d) => d.pitches)).toEqual([
      [1],
      [2],
      [3],
    ]);
  });

  it("marks cards whose rules are already verified", () => {
    const queue = draftQueue(sampleCards);
    const verified = (name: string) =>
      queue.find((e) => e.card.name === name)!.verified;
    expect(verified("Become the Shadow Lord")).toBe(true);
    expect(verified("Hocus Pocus")).toBe(false);
  });

  it("puts complete drafts first, then partial ones, then verified cards, each by name", () => {
    const hp = byName("Hocus Pocus");
    const partial: CardSummary = {
      ...hp,
      id: "card-arcane",
      name: "Arcane Test",
      variants: [
        {
          ...hp.variants[0]!,
          attributes: {
            arcaneDamage: [{ amount: 1, trigger: "on_play" }],
          },
        },
      ],
    };
    expect(
      draftQueue([...sampleCards, partial]).map((e) => [e.card.name, e.status]),
    ).toEqual([
      ["Hocus Pocus", "complete"],
      ["Arcane Test", "partial"],
      ["Become the Shadow Lord", "verified"],
    ]);
  });
});

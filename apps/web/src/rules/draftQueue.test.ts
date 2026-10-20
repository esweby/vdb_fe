// Step 9b (docs/rules-engine.md): the drafts a player checks, one per card, with pitches whose
// drafts match shown once. Cards with verified rules are marked, so they aren't checked twice.
import { describe, expect, it } from "vitest";
import type { CardSummary } from "../cards/cardRepository.ts";
import { sampleCards } from "../test/fakeCardRepository.ts";
import { draftQueue, missingFeatures } from "./draftQueue.ts";

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
            ...hp.variants[0]!.attributes,
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

// The maintainer, 20 Oct 2026, after accepting drafts with nothing in them: a card the engine
// can't draft any of is set apart, not listed with the partly drafted ones.
describe("cards with nothing drafted", () => {
  const nothing: CardSummary = {
    ...byName("Hocus Pocus"),
    id: "card-nothing",
    name: "Nothing Test",
    variants: [
      {
        ...byName("Hocus Pocus").variants[0]!,
        attributes: {
          tokens: [{ token: "runechant", amount: "X", trigger: "on_play" }],
        },
      },
    ],
  };

  it("are their own group, after the rest", () => {
    expect(
      draftQueue([...sampleCards, nothing]).map((e) => [e.card.name, e.status]),
    ).toEqual([
      ["Hocus Pocus", "complete"],
      ["Become the Shadow Lord", "verified"],
      ["Nothing Test", "undraftable"],
    ]);
  });

  it("count what's missing across cards, most common first", () => {
    const other = { ...nothing, id: "card-other", name: "Other Test" };
    expect(missingFeatures(draftQueue([nothing, other]))).toEqual([
      { what: "X Runechants", cards: 2 },
    ]);
  });
});

describe("draftQueue with verdicts", () => {
  const hocus = () => draftQueue([byName("Hocus Pocus")])[0]!;

  it("gives each draft a hash that changes with the card's facts", () => {
    const hp = byName("Hocus Pocus");
    const before = hocus().drafts[0]!.hash;
    expect(before).toMatch(/^[0-9a-f]{8}$/);
    const changed: CardSummary = {
      ...hp,
      variants: hp.variants.map((v) => ({
        ...v,
        attributes: {
          tokens: [
            {
              token: "runechant" as const,
              amount: 2,
              trigger: "on_attack" as const,
            },
          ],
        },
      })),
    };
    expect(draftQueue([changed])[0]!.drafts[0]!.hash).not.toBe(before);
  });

  it("attaches the verdict on the current draft, and moves the card to reviewed", () => {
    const hash = hocus().drafts[0]!.hash;
    const [entry] = draftQueue(
      [byName("Hocus Pocus")],
      [
        {
          cardId: "card-hocus-pocus",
          draftHash: hash,
          verdict: "accepted",
          note: null,
        },
      ],
    );
    expect(entry!.drafts[0]!.review?.verdict).toBe("accepted");
    expect(entry!.status).toBe("reviewed");
  });

  it("treats a verdict on an earlier draft as stale, not as a verdict", () => {
    const [entry] = draftQueue(
      [byName("Hocus Pocus")],
      [
        {
          cardId: "card-hocus-pocus",
          draftHash: "00000000",
          verdict: "accepted",
          note: null,
        },
      ],
    );
    expect(entry!.drafts[0]!.review).toBeUndefined();
    expect(entry!.staleReview).toBe(true);
    expect(entry!.status).toBe("complete");
  });
});

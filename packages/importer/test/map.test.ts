import { describe, expect, it } from "vitest";
import type { DatasetCard } from "../src/classify.ts";
import { parseStat, toImportCards, type AuthoredAttributes } from "../src/map.ts";
import fixture from "./fixtures/cards.json" with { type: "json" };

const entries = fixture as DatasetCard[];
const cards = toImportCards(entries, {});
const card = (name: string) => {
  const found = cards.find((c) => c.name === name);
  if (!found) throw new Error(`missing ${name}`);
  return found;
};

describe("parseStat", () => {
  it.each([
    ["", null],
    ["0", 0],
    ["3", 3],
    ["X", null],
    ["XX", null],
    ["*", null],
  ])("parses %j as %j", (input, expected) => {
    expect(parseStat(input)).toBe(expected);
  });
});

describe("toImportCards", () => {
  it("imports only legal cards, one per name", () => {
    expect(cards.map((c) => c.name).sort()).toHaveLength(9);
  });

  it("uses the name as the card's external id and the dataset id for variants", () => {
    const c = card("Become the Shadow Lord");
    expect(c.externalId).toBe("Become the Shadow Lord");
    expect(c.variants.map((v) => v.externalId)).toEqual(
      entries.filter((e) => e.name === "Become the Shadow Lord").map((e) => e.unique_id),
    );
  });

  it("maps a blue-only action", () => {
    const c = card("Become the Shadow Lord");
    expect(c).toMatchObject({
      type: "action",
      classes: ["Runeblade"],
      talents: ["Shadow"],
      subtypes: [],
      keywords: ["Go again"],
    });
    expect(c.variants).toHaveLength(1);
    expect(c.variants[0]).toMatchObject({ pitch: 3, cost: 0, power: null, defense: 3 });
  });

  it("maps attack actions", () => {
    expect(card("Deathly Delight").type).toBe("attack_action");
  });

  it("maps two-word types to snake case", () => {
    expect(card("Fate Foreseen").type).toBe("defense_reaction");
  });

  it("maps weapons with their subtypes and no pitch", () => {
    const c = card("Nebula Blade");
    expect(c).toMatchObject({ type: "weapon", subtypes: ["Sword", "2H"] });
    expect(c.variants[0]).toMatchObject({ pitch: null, power: 1 });
  });

  it("maps equipment with its slot", () => {
    expect(card("Grimoire of the Haunt")).toMatchObject({ type: "equipment", subtypes: ["Off-Hand"] });
  });

  it("orders variants by pitch", () => {
    expect(card("Arcane Cussing").variants.map((v) => v.pitch)).toEqual([1, 2, 3]);
  });

  it("keeps text on each variant, and on the card only when every variant shares it", () => {
    const cussing = card("Arcane Cussing");
    expect(cussing.text).toBeNull();
    expect(new Set(cussing.variants.map((v) => v.text)).size).toBe(3);
    expect(card("Become the Shadow Lord").text).toContain("Banish a card from your hand");
  });

  it("generates keyword attributes", () => {
    expect(card("Become the Shadow Lord").attributes).toMatchObject({
      hasGoAgain: true,
      hasBloodDebt: false,
      hasUsurp: false,
      hasRuneGate: false,
      specialization: null,
    });
    expect(card("Grimoire of the Haunt").attributes).toMatchObject({ hasBloodDebt: true });
    expect(card("Deathly Delight").attributes).toMatchObject({ hasRuneGate: true });
  });

  it("detects Viserai specializations", () => {
    expect(card("Arknight Shard").attributes).toMatchObject({ specialization: "Viserai" });
  });

  it("marks generated-only attributes as unverified", () => {
    expect(card("Become the Shadow Lord").attributesVerified).toBe(false);
  });
});

describe("authored attributes", () => {
  const authored: AuthoredAttributes = {
    "Become the Shadow Lord": {
      verified: true,
      card: { banishesOwn: [{ from: "hand", trigger: "on_play" }] },
    },
    "Arcane Cussing": {
      verified: false,
      variants: {
        1: { tokens: [{ token: "runechant", amount: 3, trigger: "on_leave_arena" }] },
        3: { tokens: [{ token: "runechant", amount: 1, trigger: "on_leave_arena" }] },
      },
    },
  };
  const withAuthored = toImportCards(entries, authored);
  const find = (name: string) => withAuthored.find((c) => c.name === name)!;

  it("merges authored card attributes over generated ones", () => {
    expect(find("Become the Shadow Lord").attributes).toMatchObject({
      hasGoAgain: true,
      banishesOwn: [{ from: "hand", trigger: "on_play" }],
    });
    expect(find("Become the Shadow Lord").attributesVerified).toBe(true);
  });

  it("puts authored variant attributes on the matching pitch", () => {
    const variants = find("Arcane Cussing").variants;
    expect(variants.find((v) => v.pitch === 1)?.attributes).toEqual({
      tokens: [{ token: "runechant", amount: 3, trigger: "on_leave_arena" }],
    });
    expect(variants.find((v) => v.pitch === 2)?.attributes).toEqual({});
    expect(variants.find((v) => v.pitch === 3)?.attributes).toEqual({
      tokens: [{ token: "runechant", amount: 1, trigger: "on_leave_arena" }],
    });
  });

  it("rejects authored attributes for a card that isn't imported, to catch typos", () => {
    expect(() => toImportCards(entries, { "Become the Shadow Lrod": { verified: false } })).toThrow(
      /Become the Shadow Lrod/,
    );
  });

  it("rejects authored variant attributes for a pitch the card doesn't have", () => {
    expect(() =>
      toImportCards(entries, { "Become the Shadow Lord": { verified: false, variants: { 1: { costReducedPerRunechant: true } } } }),
    ).toThrow(/pitch 1/);
  });

  it("rejects authored attributes outside the vocabulary, naming the card", () => {
    expect(() =>
      toImportCards(entries, {
        "Become the Shadow Lord": { verified: false, card: { canBanishFromHand: true } as never },
      }),
    ).toThrow(/Become the Shadow Lord/);
  });
});

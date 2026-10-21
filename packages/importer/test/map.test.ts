import { describe, expect, it } from "vitest";
import type { DatasetCard } from "../src/classify.ts";
import {
  activationFromText,
  optsFromText,
  parseStat,
  toImportCards,
  type AuthoredAttributes,
} from "../src/map.ts";
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
      entries
        .filter((e) => e.name === "Become the Shadow Lord")
        .map((e) => e.unique_id),
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
    expect(c.variants[0]).toMatchObject({
      pitch: 3,
      cost: 0,
      power: null,
      defense: 3,
    });
  });

  it("imports Soul of Existence, a Shadow resource with the purple pitch 4 (maintainer, 21 Oct 2026)", () => {
    // Trimmed from the pinned dataset (debce79).
    const soul: DatasetCard = {
      unique_id: "d8hLNTfQcKDtKNrWDm7dF",
      name: "Soul of Existence",
      pitch: "4",
      cost: "",
      power: "",
      defense: "",
      types: ["Shadow", "Resource", "Gem"],
      card_keywords: ["Legendary"],
      functional_text_plain: "Legendary\nWhen this is pitched, lose 1{h}.",
      type_text: "Shadow Resource - Gem",
      cc_legal: true,
      cc_banned: false,
      cc_suspended: false,
      cc_living_legend: false,
    };
    const [imported] = toImportCards([soul], {});
    expect(imported).toMatchObject({
      name: "Soul of Existence",
      type: "resource",
      talents: ["Shadow"],
      variants: [{ externalId: "d8hLNTfQcKDtKNrWDm7dF", pitch: 4 }],
    });
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
    expect(card("Grimoire of the Haunt")).toMatchObject({
      type: "equipment",
      subtypes: ["Off-Hand"],
    });
  });

  it("orders variants by pitch", () => {
    expect(card("Arcane Cussing").variants.map((v) => v.pitch)).toEqual([
      1, 2, 3,
    ]);
  });

  it("keeps text on each variant, and on the card only when every variant shares it", () => {
    const cussing = card("Arcane Cussing");
    expect(cussing.text).toBeNull();
    expect(new Set(cussing.variants.map((v) => v.text)).size).toBe(3);
    expect(card("Become the Shadow Lord").text).toContain(
      "Banish a card from your hand",
    );
  });

  it("generates keyword attributes", () => {
    expect(card("Become the Shadow Lord").attributes).toMatchObject({
      hasGoAgain: true,
      hasBloodDebt: false,
      hasUsurp: false,
      hasRuneGate: false,
      isGateTarget: false,
      canAttack: false,
      groups: ["runeblade_non_attack_action"],
      specialization: null,
    });
    expect(card("Grimoire of the Haunt").attributes).toMatchObject({
      hasBloodDebt: true,
    });
    expect(card("Deathly Delight").attributes).toMatchObject({
      hasRuneGate: true,
    });
  });

  it("marks blood debt action cards as Gate targets", () => {
    expect(card("Deathly Delight").attributes.isGateTarget).toBe(true);
    expect(card("Abyssal Bite").attributes.isGateTarget).toBe(true);
    expect(card("Grimoire of the Haunt").attributes.isGateTarget).toBe(false);
    expect(card("Become the Shadow Lord").attributes.isGateTarget).toBe(false);
  });

  it("marks weapons that can attack", () => {
    expect(card("Nebula Blade").attributes.canAttack).toBe(true);
    expect(card("Grimoire of the Haunt").attributes.canAttack).toBe(false);
  });

  it("detects Viserai specializations", () => {
    expect(card("Arknight Shard").attributes).toMatchObject({
      specialization: "Viserai",
    });
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
        1: {
          tokens: [
            { token: "runechant", amount: 3, trigger: "on_leave_arena" },
          ],
        },
        3: {
          tokens: [
            { token: "runechant", amount: 1, trigger: "on_leave_arena" },
          ],
        },
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

  it("treats authored conditional go again as not natural go again", () => {
    const cards = toImportCards(entries, {
      "Become the Shadow Lord": {
        verified: false,
        card: { goAgain: { conditions: ["banished_card_is_shadow"] } },
      },
    });
    const card = cards.find((c) => c.name === "Become the Shadow Lord")!;
    expect(card.attributes.hasGoAgain).toBe(false);
    expect(card.attributes.goAgain).toEqual({
      conditions: ["banished_card_is_shadow"],
    });
  });

  it("rejects authored attributes for a card that isn't imported, to catch typos", () => {
    expect(() =>
      toImportCards(entries, { "Become the Shadow Lrod": { verified: false } }),
    ).toThrow(/Become the Shadow Lrod/);
  });

  it("rejects authored variant attributes for a pitch the card doesn't have", () => {
    expect(() =>
      toImportCards(entries, {
        "Become the Shadow Lord": {
          verified: false,
          variants: { 1: { costReducedPerRunechant: true } },
        },
      }),
    ).toThrow(/pitch 1/);
  });

  it("adds attribute-derived groups after merging authored attributes", () => {
    const cards = toImportCards(entries, {
      "Become the Shadow Lord": {
        verified: false,
        card: { banishesOwn: [{ from: "hand", trigger: "on_play" }] },
      },
    });
    expect(
      cards.find((c) => c.name === "Become the Shadow Lord")!.attributes.groups,
    ).toEqual(["runeblade_non_attack_action", "banishes_from_hand"]);
  });

  it("rejects references to cards that aren't imported", () => {
    expect(() =>
      toImportCards(entries, {
        "Become the Shadow Lord": {
          verified: false,
          card: {
            enablesPlayFromBanish: [{ target: { card: "Darkest Hourr" } }],
          },
        },
      }),
    ).toThrow(/Darkest Hourr/);
  });

  // Retired cards (e.g. Living Legend weapons) keep their checked attributes, unused.
  it("accepts attributes for a retired card, but still rejects unknown names", () => {
    const retired = entries.map((c) =>
      c.name === "Nebula Blade" ? { ...c, cc_living_legend: true } : c,
    );
    expect(() =>
      toImportCards(retired, { "Nebula Blade": { verified: true, card: {} } }),
    ).not.toThrow();
    expect(
      toImportCards(retired, {}).some((c) => c.name === "Nebula Blade"),
    ).toBe(false);
    expect(() =>
      toImportCards(retired, { "Nebula Bladee": { verified: true, card: {} } }),
    ).toThrow(/Nebula Bladee/);
  });

  it("accepts references to imported cards", () => {
    expect(() =>
      toImportCards(entries, {
        "Become the Shadow Lord": {
          verified: false,
          card: {
            tutors: [
              {
                target: { card: "Nebula Blade" },
                to: "hand",
                trigger: "on_play",
              },
            ],
          },
        },
      }),
    ).not.toThrow();
  });

  it("rejects authored attributes outside the vocabulary, naming the card", () => {
    expect(() =>
      toImportCards(entries, {
        "Become the Shadow Lord": {
          verified: false,
          card: { canBanishFromHand: true } as never,
        },
      }),
    ).toThrow(/Become the Shadow Lord/);
  });
});

// The maintainer, 20 Oct 2026: Opt is very important, and lived only in a note. It's read from
// each pitch's text, with when it happens.
describe("optsFromText", () => {
  it.each([
    [
      "Opt 3, then banish the top card of your deck.",
      [{ amount: 3, trigger: "on_play" }],
    ],
    [
      "Opt 2 Banish the top card of your deck. Go again",
      [{ amount: 2, trigger: "on_play" }],
    ],
    ["When this attacks, opt 1.", [{ amount: 1, trigger: "on_attack" }]],
    [
      "When this hits, opt 2. If this was played from arsenal, it gets go again.",
      [{ amount: 2, trigger: "on_hit" }],
    ],
    ["When this defends, opt 1.", [{ amount: 1, trigger: "on_defend" }]],
    [
      "Legendary When this is pitched, opt 2.",
      [{ amount: 2, trigger: "on_pitch" }],
    ],
    [
      "The next attack action card you play this turn gets +3{p}. If this was played from arsenal, opt 2. Go again",
      [{ amount: 2, trigger: "on_play", fromArsenal: true }],
    ],
    ["Instant - Destroy this: Opt 2.", [{ amount: 2, trigger: "activated" }]],
    [
      "Action - {r}, destroy this: Opt 1, then create a Runechant token. Go again",
      [{ amount: 1, trigger: "activated" }],
    ],
    [
      "Instant - {r}, destroy this: Prevent the next 1 damage that would be dealt to you this turn. Opt 1",
      [{ amount: 1, trigger: "activated" }],
    ],
    ["Create a Runechant token.", []],
  ])("reads %j", (text, expected) => {
    expect(optsFromText(text)).toEqual(expected);
  });

  it("records Opt on each pitch's attributes when importing", () => {
    const entry = entries.find((e) => e.name === "Become the Shadow Lord")!;
    const [imported] = toImportCards(
      [
        {
          ...entry,
          name: "Opt test",
          unique_id: "opt-test",
          functional_text_plain:
            "Opt 3, then banish the top card of your deck.",
        },
      ],
      {},
    );
    expect(imported!.variants[0]!.attributes.opt).toEqual([
      { amount: 3, trigger: "on_play" },
    ]);
  });
});

// Activated abilities, read from the text (the maintainer asked for an activate action, 20 Oct
// 2026). Speed, resource cost, how the card itself pays, and whether there's more to pay.
describe("activationFromText", () => {
  it.each([
    [
      "Instant - {r}, destroy this: Create a Runechant token.",
      { speed: "instant", cost: 1, pay: "destroy" },
    ],
    [
      "Action - {r}, destroy this: Opt 1, then create a Runechant token. Go again",
      { speed: "action", cost: 1, pay: "destroy" },
    ],
    [
      "Instant - Banish this from your hand: Prevent the next 4 damage that would be dealt to you this turn. Blood Debt",
      { speed: "instant", cost: 0, pay: "banish_from_hand" },
    ],
    [
      "Instant - {r}, banish this: Create an Eloquence token. Arcane Barrier 1 Blood Debt",
      { speed: "instant", cost: 1, pay: "banish" },
    ],
    [
      "Instant - Discard this: Create a Runechant token.",
      { speed: "instant", cost: 0, pay: "discard" },
    ],
    [
      "Action - {r}{r}: Create a Runechant token.",
      { speed: "action", cost: 2, pay: "none" },
    ],
    [
      "Instant - Destroy this: Opt 2",
      { speed: "instant", cost: 0, pay: "destroy" },
    ],
    [
      "Instant - {t} your hero, destroy this: Gain {r} Blade Break",
      { speed: "instant", cost: 0, pay: "destroy", extraCost: true },
    ],
    [
      "Instant - Discard a card: This gets +3{d}",
      { speed: "instant", cost: 0, pay: "none", extraCost: true },
    ],
    [
      "At the start of your turn, if this has less than 3 energy counters, you may put an energy counter on it. Instant - Remove 3 energy counters from this: Gain {r} Blade Break",
      { speed: "instant", cost: 0, pay: "none", extraCost: true },
    ],
    [
      "If you've dealt arcane damage this turn, you may play this as though it were an instant.",
      undefined,
    ],
    ["Create a Runechant token. Go again", undefined],
  ])("reads %j", (text, expected) => {
    expect(activationFromText(text)).toEqual(expected);
  });
});

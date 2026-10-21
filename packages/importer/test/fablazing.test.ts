import { describe, expect, it } from "vitest";
import type { ImportCard, ImportHero } from "../src/map.ts";
import { cardMapRows, cardSets, fablazingSlug } from "../src/fablazing.ts";

describe("fablazingSlug", () => {
  // Each case is a real FaBlazing card id for that name and pitch.
  it.each([
    ["Murmuring Gloomblade", 1, "murmuring_gloomblade_red"],
    ["Malefic Incantation", 2, "malefic_incantation_yellow"],
    ["Become the Shadow Lord", 3, "become_the_shadow_lord_blue"],
    ["Open the Gate to i'Arathael", 1, "open_the_gate_to_iarathael_red"],
    ["Fyendal's Spring Tunic", null, "fyendals_spring_tunic"],
    ["Seven Sin Nebula", null, "seven_sin_nebula"],
    ["Check-Raise", 1, "check_raise_red"],
    ["Riches of Trōpal-Dhani", 2, "riches_of_tropal_dhani_yellow"],
    ["Soul of Existence", 4, "soul_of_existence_purple"],
    ["Even Bigger Than That!", 1, "even_bigger_than_that_red"],
  ])("%s, pitch %s → %s", (name, pitch, slug) => {
    expect(fablazingSlug(name, pitch)).toBe(slug);
  });
});

function card(
  name: string,
  pitches: (number | null)[],
  // Loosely typed so tests can write tokens as plain objects.
  attributes: object = {},
): ImportCard {
  return {
    name,
    attributes,
    variants: pitches.map((pitch) => ({ pitch })),
  } as unknown as ImportCard;
}

describe("cardSets", () => {
  const sets = cardSets([
    card("Deadwood Dirge", [1, 2, 3], {
      hasBloodDebt: true,
      isGateTarget: true,
    }),
    card("Shadow Instant", [1], { hasBloodDebt: true, isGateTarget: false }),
    card("Malefic Incantation", [1, 2, 3], { hasBloodDebt: false }),
    card("Corrupted Crown", [null]),
    card("Reach of the Abyss", [null]),
  ]);

  it("lists every pitch of every blood debt card", () => {
    expect(sets.blood_debt).toEqual([
      "deadwood_dirge_blue",
      "deadwood_dirge_red",
      "deadwood_dirge_yellow",
      "shadow_instant_red",
    ]);
  });

  it("lists Gate targets separately", () => {
    expect(sets.gate_target).toEqual([
      "deadwood_dirge_blue",
      "deadwood_dirge_red",
      "deadwood_dirge_yellow",
    ]);
  });
});

describe("cardSets: Gate makers", () => {
  const gate = (trigger: string, extra: object = {}) => ({
    tokens: [{ token: "gate", amount: 1, trigger, ...extra }],
  });
  const sets = cardSets([
    card("Rites of Nightfall", [3], gate("on_play")),
    card("Countdown to Extinction", [1, 3], gate("on_attack")),
    card(
      "Step through Realms",
      [1],
      gate("on_hit", { grantedTo: "next_shadow_attack" }),
    ),
    card("Breach Flesh", [1, 2], gate("on_hit")),
    card("Dam the Shadowake", [1], gate("on_defend")),
    card("Open the Gate to i'Arathael", [1], {
      tokens: [
        { token: "gate", amount: 1, trigger: "on_hit" },
        { token: "gate", amount: 1, trigger: "on_banished" },
      ],
    }),
    card("Runic Card", [1], {
      tokens: [{ token: "runechant", amount: 1, trigger: "on_play" }],
    }),
    card("Corrupted Crown", [null]),
    card("Reach of the Abyss", [null]),
  ]);

  it("lists cards whose Gate comes when they're played or attack, including Gates granted to a later attack", () => {
    expect(sets.gate_maker_on_play).toEqual([
      "countdown_to_extinction_blue",
      "countdown_to_extinction_red",
      "rites_of_nightfall_blue",
      "step_through_realms_red",
    ]);
  });

  it("lists cards whose own hit makes a Gate", () => {
    expect(sets.gate_maker_on_hit).toEqual([
      "breach_flesh_red",
      "breach_flesh_yellow",
      "open_the_gate_to_iarathael_red",
    ]);
  });

  it("lists cards that make a Gate when they defend", () => {
    expect(sets.gate_maker_on_block).toEqual(["dam_the_shadowake_red"]);
  });

  it("keeps the maintainer's banishing equipment", () => {
    expect(sets.banish_equipment).toEqual([
      "corrupted_crown",
      "reach_of_the_abyss",
    ]);
  });

  it("refuses an authored set naming a card that isn't imported", () => {
    expect(() => cardSets([card("Corrupted Crown", [null])])).toThrow(
      /Reach of the Abyss/,
    );
  });
});

describe("cardMapRows", () => {
  const cards = [
    {
      name: "Deadwood Dirge",
      variants: [
        { externalId: "dd-r", pitch: 1 },
        { externalId: "dd-b", pitch: 3 },
      ],
    },
    {
      name: "Seven Sin Nebula",
      variants: [{ externalId: "ssn", pitch: null }],
    },
  ] as unknown as ImportCard[];
  const heroes = [
    { externalId: "h-forsaken", name: "Viserai, the Forsaken" },
    { externalId: "h-usurper", name: "Viserai, Usurper" },
  ] as unknown as ImportHero[];

  it("maps every variant, and each hero side to its hero row", () => {
    expect(cardMapRows(cards, heroes)).toEqual([
      { slug: "deadwood_dirge_blue", variantExternalId: "dd-b" },
      { slug: "deadwood_dirge_red", variantExternalId: "dd-r" },
      { slug: "seven_sin_nebula", variantExternalId: "ssn" },
      { slug: "viserai_the_forsaken", heroExternalId: "h-forsaken" },
      { slug: "viserai_usurper", heroExternalId: "h-usurper" },
    ]);
  });

  it("maps a slug once, preferring the hero", () => {
    const clash = [
      {
        name: "Viserai, Usurper",
        variants: [{ externalId: "c", pitch: null }],
      },
    ] as unknown as ImportCard[];
    expect(cardMapRows(clash, heroes.slice(1))).toEqual([
      { slug: "viserai_usurper", heroExternalId: "h-usurper" },
    ]);
  });
});

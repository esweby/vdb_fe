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
  attributes: Partial<ImportCard["attributes"]> = {},
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

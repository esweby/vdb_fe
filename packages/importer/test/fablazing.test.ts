import { describe, expect, it } from "vitest";
import type { ImportCard } from "../src/map.ts";
import { cardSets, fablazingSlug } from "../src/fablazing.ts";

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

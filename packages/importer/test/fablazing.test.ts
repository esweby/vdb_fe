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
    ["Jarl Vetreiði", null, "jarl_vetreidi"],
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
    { externalId: "h-levia", name: "Levia, Shadowborn Abomination" },
    { externalId: "h-teklo", name: "Teklovossen, Esteemed Magnate" },
    { externalId: "h-jarl", name: "Jarl Vetreiði" },
  ] as unknown as ImportHero[];

  it("maps every variant, and each hero side to its hero row", () => {
    expect(cardMapRows(cards, heroes)).toEqual(
      [
        { slug: "deadwood_dirge_blue", variantExternalId: "dd-b" },
        { slug: "deadwood_dirge_red", variantExternalId: "dd-r" },
        { slug: "seven_sin_nebula", variantExternalId: "ssn" },
        { slug: "viserai_the_forsaken", heroExternalId: "h-forsaken" },
        { slug: "viserai_usurper", heroExternalId: "h-usurper" },
        { slug: "levia_shadowborn_abomination", heroExternalId: "h-levia" },
        { slug: "levia_redeemed", heroExternalId: "h-levia" },
        { slug: "blasmophet_levia_consumed", heroExternalId: "h-levia" },
        { slug: "teklovossen_esteemed_magnate", heroExternalId: "h-teklo" },
        { slug: "teklovossen_the_mechropotent", heroExternalId: "h-teklo" },
        { slug: "jarl_vetreidi", heroExternalId: "h-jarl" },
        { slug: "jarl_vetreidi~BLIND", heroExternalId: "h-jarl" },
        ...IGNORED.map((slug) => ({ slug, ignored: true })),
      ].sort((a, b) => a.slug.localeCompare(b.slug)),
    );
  });

  it("maps a slug once, preferring the hero", () => {
    const clash = [
      {
        name: "Viserai, Usurper",
        variants: [{ externalId: "c", pitch: null }],
      },
    ] as unknown as ImportCard[];
    expect(
      cardMapRows(clash, heroes.slice(1)).find(
        (r) => r.slug === "viserai_usurper",
      ),
    ).toEqual({ slug: "viserai_usurper", heroExternalId: "h-usurper" });
  });
});

// FaBlazing records the hero a side ended the game as, so a hero that transformed shows up as its
// Demi-Hero. The maintainer's calls, 21 Oct 2026.
const IGNORED = [
  // Arakni, Marionette's Agents of Chaos: Marionette became a Living Legend on 19 Oct 2026.
  "arakni_black_widow",
  "arakni_funnel_web",
  "arakni_marionette",
  "arakni_orb_weaver",
  "arakni_redback",
  "arakni_tarantula",
  "arakni_trap_door",
  // New, not in the dataset yet; ignored for a few months.
  "azalea_ace_of_spades",
  "UNKNOWNHERO",
  // A weapon recorded as a side's hero in one game on 18 Oct 2026 (the maintainer, 28 Oct 2026).
  "redwood_hammer",
];

describe("cardMapRows: heroes FaBlazing ends games as", () => {
  const heroes = [
    { externalId: "h-levia", name: "Levia, Shadowborn Abomination" },
    { externalId: "h-teklo", name: "Teklovossen, Esteemed Magnate" },
    { externalId: "h-marionette", name: "Arakni, Marionette" },
    { externalId: "h-jarl", name: "Jarl Vetreiði" },
  ] as unknown as ImportHero[];
  const rows = cardMapRows([], heroes);
  const target = (slug: string) => rows.find((r) => r.slug === slug);

  it("counts each Demi-Hero as the hero that transformed into it", () => {
    expect(target("levia_redeemed")).toEqual({
      slug: "levia_redeemed",
      heroExternalId: "h-levia",
    });
    expect(target("blasmophet_levia_consumed")).toEqual({
      slug: "blasmophet_levia_consumed",
      heroExternalId: "h-levia",
    });
    expect(target("teklovossen_the_mechropotent")).toEqual({
      slug: "teklovossen_the_mechropotent",
      heroExternalId: "h-teklo",
    });
  });

  it("counts a hero's other FaBlazing ids as that hero", () => {
    // Seen once, 19 Oct 2026: probably Talishar's hidden-hero mode. The maintainer, 28 Oct 2026.
    expect(target("jarl_vetreidi~BLIND")).toEqual({
      slug: "jarl_vetreidi~BLIND",
      heroExternalId: "h-jarl",
    });
  });

  it("fails if another id's hero isn't imported", () => {
    expect(() => cardMapRows([], heroes.slice(0, 3))).toThrow(/Jarl Vetreiði/);
  });

  it("marks the ids the maintainer ignores, even over a hero row", () => {
    for (const slug of IGNORED)
      expect(target(slug)).toEqual({ slug, ignored: true });
  });

  it("fails if a Demi-Hero's hero isn't imported", () => {
    expect(() => cardMapRows([], heroes.slice(1))).toThrow(
      /Levia, Shadowborn Abomination/,
    );
  });
});

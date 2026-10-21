// Card ids and card sets for the FaBlazing data pipeline (services/fablazing).
// FaBlazing (Talishar) ids are the card name as a slug plus the pitch colour,
// e.g. "Open the Gate to i'Arathael", pitch 1 → open_the_gate_to_iarathael_red.
import type { ImportCard, ImportHero } from "./map.ts";

const COLOURS: Record<number, string> = {
  1: "red",
  2: "yellow",
  3: "blue",
  4: "purple",
};

export function fablazingSlug(name: string, pitch: number | null): string {
  const base = name
    // Letters NFKD doesn't split into a base letter and an accent.
    .replace(/ð/gi, "d")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const colour = pitch === null ? undefined : COLOURS[pitch];
  return colour ? `${base}_${colour}` : base;
}

/**
 * Equipment that banishes your own cards when it blocks, so a block with it can make a Gate (by
 * banishing Open the Gate to i'Arathael). The maintainer's judgement, 21 Oct 2026, not derived:
 * the banish actions aren't logged, only the blocks.
 */
const BANISH_EQUIPMENT = ["Corrupted Crown", "Reach of the Abyss"];

type Attributes = ImportCard["attributes"];
type Token = NonNullable<Attributes["tokens"]>[number];

/** Named groups of FaBlazing ids that chain specs refer to, from our card facts. */
export function cardSets(cards: ImportCard[]): Record<string, string[]> {
  const slugs = (keep: (c: ImportCard) => boolean) =>
    cards
      .filter(keep)
      .flatMap((c) => c.variants.map((v) => fablazingSlug(c.name, v.pitch)))
      .sort();
  // By pitch, since a pitch's attributes can replace the card's tokens.
  const gateMakers = (keep: (t: Token) => boolean) =>
    cards
      .flatMap((c) =>
        c.variants
          .filter((v) =>
            ({ ...c.attributes, ...v.attributes }).tokens?.some(
              (t) => t.token === "gate" && keep(t),
            ),
          )
          .map((v) => fablazingSlug(c.name, v.pitch)),
      )
      .sort();
  const named = (names: string[]) => {
    const missing = names.filter((n) => !cards.some((c) => c.name === n));
    if (missing.length)
      throw new Error(`Card sets name ${missing.join(", ")}, not imported`);
    return slugs((c) => names.includes(c.name));
  };
  return {
    blood_debt: slugs((c) => c.attributes.hasBloodDebt === true),
    gate_target: slugs((c) => c.attributes.isGateTarget === true),
    // Each set is a logged event: the card played (its play or attack makes the Gate, or grants
    // one to a later attack whose hit isn't tied to it), its own hit, or its block. Gates made on
    // banish aren't logged.
    gate_maker_on_play: gateMakers(
      (t) =>
        t.grantedTo !== undefined ||
        t.trigger === "on_play" ||
        t.trigger === "on_attack",
    ),
    gate_maker_on_hit: gateMakers(
      (t) => t.grantedTo === undefined && t.trigger === "on_hit",
    ),
    gate_maker_on_block: gateMakers((t) => t.trigger === "on_defend"),
    banish_equipment: named(BANISH_EQUIPMENT),
  };
}

export type CardMapRow =
  | { slug: string; variantExternalId: string }
  | { slug: string; heroExternalId: string }
  | { slug: string; ignored: true };

/**
 * FaBlazing records the hero a side ended the game as, so a hero that transformed shows up as its
 * Demi-Hero. Each Demi-Hero counts as the hero it came from. The maintainer's call, 21 Oct 2026.
 */
const DEMI_HEROES: Record<string, string> = {
  "Levia, Redeemed": "Levia, Shadowborn Abomination",
  "Blasmophet, Levia Consumed": "Levia, Shadowborn Abomination",
  "Teklovossen, the Mechropotent": "Teklovossen, Esteemed Magnate",
};

/** FaBlazing hero ids left out of matchups and the unmatched list. The maintainer's call, 21 Oct 2026. */
const IGNORED_SLUGS = [
  // Arakni, Marionette became a Living Legend on 19 Oct 2026, and its Agents of Chaos with it.
  "arakni_marionette",
  "arakni_black_widow",
  "arakni_funnel_web",
  "arakni_orb_weaver",
  "arakni_redback",
  "arakni_tarantula",
  "arakni_trap_door",
  // New, not in the pinned dataset yet: ignored for a few months.
  "azalea_ace_of_spades",
  // FaBlazing's id for a hero it couldn't read.
  "UNKNOWNHERO",
];

/**
 * Rows for fablazing_card_map: every variant by its slug, every hero side and Demi-Hero to its
 * hero row, and the ignored ids. A slug is mapped once; a hero wins over a card of the same name,
 * and an ignored id wins over both.
 */
export function cardMapRows(
  cards: ImportCard[],
  heroes: ImportHero[],
): CardMapRow[] {
  const rows = new Map<string, CardMapRow>();
  for (const c of cards)
    for (const v of c.variants) {
      const slug = fablazingSlug(c.name, v.pitch);
      if (!rows.has(slug))
        rows.set(slug, { slug, variantExternalId: v.externalId });
    }
  for (const h of heroes) {
    const slug = fablazingSlug(h.name, null);
    rows.set(slug, { slug, heroExternalId: h.externalId });
  }
  for (const [demi, heroName] of Object.entries(DEMI_HEROES)) {
    const hero = heroes.find((h) => h.name === heroName);
    if (!hero)
      throw new Error(`${demi} counts as ${heroName}, which isn't imported`);
    const slug = fablazingSlug(demi, null);
    rows.set(slug, { slug, heroExternalId: hero.externalId });
  }
  for (const slug of IGNORED_SLUGS) rows.set(slug, { slug, ignored: true });
  return [...rows.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

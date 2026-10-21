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
  | { slug: string; heroExternalId: string };

/**
 * Rows for fablazing_card_map: every variant by its slug, and every hero side to its own hero
 * row. A slug is mapped once; a hero wins over a card of the same name.
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
  return [...rows.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

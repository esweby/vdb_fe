// A FaBrary deck import link (fabrary.net/decks?tab=import): opens FaBrary's import form
// filled in with the deck, and the player presses Import there. Nothing is saved for them.
// Cards use FaBrary's own identifiers (name, then pitch colour: "snatch-red"). The rule is
// read from FaBrary's documented examples; Viserai's identifiers are unverified until someone
// signed in to FaBrary has tried a link.
import { PITCH_NAMES } from "./deckRules.ts";

/** What the link needs from a deck entry. */
export interface FabraryEntry {
  card: { name: string };
  variant: { pitch: number | null };
  quantity: number;
}

/** FaBrary's longest deck name. */
const NAME_MAX = 50;

/** FaBrary's identifier for a card: "Fyendal's Spring Tunic" → "fyendals-spring-tunic". */
export function fabraryId(name: string, pitch: number | null): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const colour = pitch === null ? undefined : PITCH_NAMES[pitch];
  return colour ? `${base}-${colour}` : base;
}

/** A link to FaBrary's import tab with the hero and every card, one identifier per copy. */
export function fabraryImportLink(
  hero: string,
  deckName: string,
  entries: readonly FabraryEntry[],
): string {
  const cards = [
    fabraryId(hero, null),
    ...entries.flatMap((e) =>
      Array<string>(e.quantity).fill(fabraryId(e.card.name, e.variant.pitch)),
    ),
  ];
  const params = new URLSearchParams({
    tab: "import",
    format: "Classic Constructed",
    name: deckName.slice(0, NAME_MAX),
  });
  // Commas stay readable; URLSearchParams would encode them as %2C.
  return `https://fabrary.net/decks?${params}&cards=${cards.join(",")}`;
}

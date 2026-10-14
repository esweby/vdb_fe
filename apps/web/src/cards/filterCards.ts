import type { CardSummary } from "./cardRepository.ts";

export type CardClass = "Runeblade" | "Shadow" | "Generic";

export interface CardFilters {
  search: string;
  /** Empty = any pitch. A card matches if any variant has one of these pitches. */
  pitches: number[];
  type: string | null;
  cardClass: CardClass | null;
  sort: "name" | "type";
}

export const TYPE_LABELS: Record<string, string> = {
  action: "Action",
  attack_action: "Attack action",
  instant: "Instant",
  attack_reaction: "Attack reaction",
  defense_reaction: "Defense reaction",
  block: "Block",
  resource: "Resource",
  weapon: "Weapon",
  equipment: "Equipment",
};

const TYPE_ORDER = Object.keys(TYPE_LABELS);

/** "Shadow Runeblade", "Runeblade", "Shadow" or "Generic". */
export function classOf(card: CardSummary): string {
  return [...card.talents, ...card.classes].join(" ");
}

function inClass(card: CardSummary, cardClass: CardClass): boolean {
  return cardClass === "Shadow"
    ? card.talents.includes("Shadow")
    : card.classes.includes(cardClass);
}

export function filterCards(
  cards: CardSummary[],
  f: CardFilters,
): CardSummary[] {
  const search = f.search.trim().toLowerCase();
  return cards
    .filter((c) => !search || c.name.toLowerCase().includes(search))
    .filter(
      (c) =>
        f.pitches.length === 0 ||
        c.variants.some((v) => v.pitch !== null && f.pitches.includes(v.pitch)),
    )
    .filter((c) => !f.type || c.type === f.type)
    .filter((c) => !f.cardClass || inClass(c, f.cardClass))
    .sort((a, b) =>
      f.sort === "type"
        ? TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
          a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
}

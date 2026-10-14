// Search and sort for card lists. Facet filtering lives in facets.ts / filters/.
import type { CardSummary } from "./cardRepository.ts";

export type CardSort = "name" | "type";

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
export function classOf(
  card: Pick<CardSummary, "talents" | "classes">,
): string {
  return [...card.talents, ...card.classes].join(" ");
}

export function searchAndSort(
  cards: CardSummary[],
  search: string,
  sort: CardSort,
): CardSummary[] {
  const q = search.trim().toLowerCase();
  return cards
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) =>
      sort === "type"
        ? TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
          a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
}

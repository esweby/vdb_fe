// Search and sort for card lists. Facet filtering lives in facets.ts / filters/.
import type { CardSummary } from "./cardRepository.ts";

export type CardSort =
  "newest" | "name" | "type" | "cost" | "power" | "defense";

export const isClassCard = (c: CardSummary) =>
  c.classes.includes("Runeblade") || c.talents.includes("Shadow");

/** Newest release first (undated cards after the dated ones), then by name. */
export const newestFirst = (a: CardSummary, b: CardSummary) =>
  (b.firstReleased ?? "").localeCompare(a.firstReleased ?? "") ||
  a.name.localeCompare(b.name);
export type Stat = "cost" | "power" | "defense";

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

/** One value when every pitch agrees, each pitch's value when they differ, "–" when none. */
export function statText(card: CardSummary, stat: Stat): string {
  const values = [...card.variants]
    .sort((a, b) => (a.pitch ?? 0) - (b.pitch ?? 0))
    .map((v) => v[stat]);
  if (values.every((v) => v === null)) return "–";
  const shown = values.map((v) => (v === null ? "–" : String(v)));
  return new Set(shown).size === 1 ? shown[0]! : shown.join(" / ");
}

const statValues = (c: CardSummary, stat: Stat) =>
  c.variants.map((v) => v[stat]).filter((v): v is number => v !== null);

/** Sort key: lowest cost, highest power or defense. Cards without the stat go last. */
function statKey(c: CardSummary, stat: Stat): number | null {
  const values = statValues(c, stat);
  if (values.length === 0) return null;
  return stat === "cost" ? Math.min(...values) : -Math.max(...values);
}

/**
 * Whether a card matches a search: its name, a keyword (Usurp, Blood Debt, Go again…) or its
 * type line (Shadow, Weapon, Sword…). The card database and Add cards share it.
 */
export function matchesSearch(card: CardSummary, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const typeLine = [
    ...card.talents,
    ...card.classes,
    TYPE_LABELS[card.type] ?? card.type,
    ...card.subtypes,
  ].join(" ");
  return [card.name, ...card.keywords, typeLine].some((s) =>
    s.toLowerCase().includes(q),
  );
}

export function searchAndSort(
  cards: CardSummary[],
  search: string,
  sort: CardSort,
): CardSummary[] {
  return cards
    .filter((c) => matchesSearch(c, search))
    .sort((a, b) => {
      if (sort === "type") {
        return (
          TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
          a.name.localeCompare(b.name)
        );
      }
      // The review priority: Runeblade and Shadow first, generics last, each newest first.
      if (sort === "newest")
        return (
          Number(isClassCard(b)) - Number(isClassCard(a)) || newestFirst(a, b)
        );
      if (sort === "name") return a.name.localeCompare(b.name);
      const ka = statKey(a, sort);
      const kb = statKey(b, sort);
      if (ka === null || kb === null) {
        return ka === kb ? a.name.localeCompare(b.name) : ka === null ? 1 : -1;
      }
      return ka - kb || a.name.localeCompare(b.name);
    });
}

/**
 * The card page's tabs (the maintainer, 21 Oct 2026): the card stays beside them, everything
 * else is grouped. Kept in the URL as ?tab= on the card page and ?cardTab= in a pop-over.
 */
export const CARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "scoring", label: "Scoring" },
  { id: "synergy", label: "Synergy" },
  { id: "real-games", label: "In real games" },
] as const;

export type CardTab = (typeof CARD_TABS)[number]["id"];

export const isCardTab = (value: unknown): value is CardTab =>
  CARD_TABS.some((t) => t.id === value);

/** The tab to show: the one asked for, else Scoring for scorers and Overview for everyone else. */
export function resolveCardTab(value: unknown, canScore: boolean): CardTab {
  if (isCardTab(value)) return value;
  return canScore ? "scoring" : "overview";
}

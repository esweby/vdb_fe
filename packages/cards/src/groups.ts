// Card groups: named sets of cards that other cards refer to ("an aura with Runechant in its name").
// Membership is derived from card facts, so new cards join groups automatically.

export const CARD_GROUPS = [
  "runechant_aura",
  "runeblade_aura",
  "runeblade_attack_action",
  "runeblade_non_attack_action",
  "rune_gate",
] as const;

export type CardGroup = (typeof CARD_GROUPS)[number];

export interface GroupableCard {
  name: string;
  type: string;
  subtypes: string[];
  classes: string[];
  keywords?: string[];
}

export function groupsOf(card: GroupableCard): CardGroup[] {
  const groups: CardGroup[] = [];
  const aura = card.subtypes.includes("Aura");
  const runeblade = card.classes.includes("Runeblade");
  // The sinchants: Runechant of Envy, Gluttony, Greed, Lust, Pride, Sloth and Wrath.
  if (aura && card.name.includes("Runechant")) groups.push("runechant_aura");
  if (aura && runeblade) groups.push("runeblade_aura");
  if (runeblade && card.type === "attack_action") {
    groups.push("runeblade_attack_action");
  }
  if (runeblade && card.type === "action") {
    groups.push("runeblade_non_attack_action");
  }
  if (card.keywords?.includes("Rune Gate")) groups.push("rune_gate");
  return groups;
}

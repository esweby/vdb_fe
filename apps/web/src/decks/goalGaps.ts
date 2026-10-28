// UNVERIFIED: these are card-data checks, not a judgement about strategic sufficiency.
import type { RoleId } from "@vdb/cards";
import { sectionOf, type DeckEntry } from "./deckRules.ts";
import { variantRoles } from "./gaps.ts";

export const GOALS = [
  {
    id: "runechant",
    label: "Runechant generation",
    roles: ["runechant_generator"],
  },
  { id: "gate", label: "Gate generation", roles: ["gate_generator"] },
  { id: "damage", label: "More damage", roles: [] },
  { id: "disruption", label: "Disruption", roles: ["disruption"] },
  { id: "defence", label: "Defence", roles: [] },
  { id: "tempo", label: "Go again", roles: ["go_again_granter"] },
  {
    id: "banish",
    label: "Banish support",
    roles: ["hand_banisher", "deck_banisher", "self_banisher"],
  },
] as const;
export type GoalId = (typeof GOALS)[number]["id"];

export function supportsGoal(
  entry: Pick<DeckEntry, "card" | "variant">,
  id: GoalId,
): boolean {
  if (sectionOf(entry.card) !== "deck") return false;
  if (id === "damage") return (entry.variant.power ?? 0) > 0;
  if (id === "defence") return (entry.variant.defense ?? 0) > 0;
  const roles = variantRoles(entry.card, entry.variant);
  return GOALS.find((goal) => goal.id === id)!.roles.some((role) =>
    roles.includes(role as RoleId),
  );
}

export function analyseGoals(entries: DeckEntry[], selected: GoalId[]) {
  return GOALS.filter((goal) => selected.includes(goal.id)).map((goal) => {
    const supporting = entries.filter((entry) => supportsGoal(entry, goal.id));
    const main = supporting.filter((entry) => !entry.sideboard);
    const sideboard = supporting.filter((entry) => entry.sideboard);
    const copies = (items: DeckEntry[]) =>
      items.reduce((sum, entry) => sum + entry.quantity, 0);
    const mainCopies = copies(main);
    const sideboardCopies = copies(sideboard);
    const status =
      mainCopies > 0
        ? "present"
        : sideboardCopies > 0
          ? "sideboard"
          : "missing";
    return { goal, main, sideboard, mainCopies, sideboardCopies, status };
  });
}

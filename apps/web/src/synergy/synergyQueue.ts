// The confirm-suggestions queue (README "Synergy graph"): the links the derived rules propose,
// in the order a scorer should check them. Feedback is recorded per rule, so a verdict on a
// link is saved for every rule behind it and the link's weight follows the vote.
import type { SynergyEdge } from "@vdb/cards";
import type { FeedbackRow } from "./synergyRepository.ts";

export const pairKey = (from: string, to: string) => `${from}\u0000${to}`;

/**
 * Links between Runeblade and Shadow cards first (as in Needs review), then the strongest,
 * then by the cards' names. Links already answered are left out.
 */
export function synergyQueue<T extends { name: string; classCard: boolean }>(
  edges: SynergyEdge[],
  cards: Map<string, T>,
  answered: Set<string>,
): SynergyEdge[] {
  const both = (e: SynergyEdge) =>
    Number(!!cards.get(e.from)?.classCard && !!cards.get(e.to)?.classCard);
  const name = (id: string) => cards.get(id)?.name ?? "";
  return edges
    .filter((e) => !answered.has(pairKey(e.from, e.to)))
    .sort(
      (a, b) =>
        both(b) - both(a) ||
        b.weight - a.weight ||
        name(a.from).localeCompare(name(b.from)) ||
        name(a.to).localeCompare(name(b.to)),
    );
}

export function feedbackRows(
  edge: SynergyEdge,
  verdict: FeedbackRow["verdict"],
  weight: number | null = null,
): FeedbackRow[] {
  return edge.reasons.map((ruleId) => ({
    ruleId,
    fromCardId: edge.from,
    toCardId: edge.to,
    verdict,
    weight: verdict === "reweight" ? weight : null,
  }));
}

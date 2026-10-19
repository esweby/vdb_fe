// Synergy in the ranking (README "Suggested core", docs/synergy-rules.md "Synergy in the
// ranking"): Fill to targets picks cards one at a time by value + synergy with the cards
// already picked. Synergy saturates at 1 per engine, so a busy engine can't swamp the value.
// The strength is UNVERIFIED tuning, off by default until the scoring group agrees one.
import { SYNERGY_RULES, type SynergyEdge } from "@vdb/cards";
import { feedbackWeight, type CommunityFeedbackRow } from "@vdb/scoring";
import type {
  CoreCandidate,
  CoreConstraints,
  CoreSuggestion,
} from "./suggestCore.ts";

export interface SynergyLink {
  other: string;
  weight: number;
  /** The engine the link counts under; "reference" for direct references, "community" for
   * the scoring group's own links that no rule makes. */
  bucket: string;
}

/** Card id → its links, both ways round (a card gains from partners either side). */
export type SynergyGraph = Map<string, SynergyLink[]>;

export interface SynergyInput {
  derived: SynergyEdge[];
  /** Admin-set weights by rule id; a rule without one uses its default. */
  ruleWeights: Record<string, number>;
  feedback: Pick<
    CommunityFeedbackRow,
    "ruleId" | "fromCardId" | "toCardId" | "confirmShare" | "fixedPart"
  >[];
  community: { fromCardId: string; toCardId: string; weight: number }[];
}

/** A directed link at its final weight, and where it comes from. */
export interface WeightedEdge {
  from: string;
  to: string;
  weight: number;
  /** See SynergyLink. */
  bucket: string;
  /** From the rules, the scoring group's own links, or both. */
  kind: "rule" | "community" | "both";
  traverse: boolean;
  reasons: string[];
}

/**
 * Every link at its final weight: a rule's weight (the admins', or the default), changed by
 * the scoring group's feedback, and raised by their own link where that's higher. Rule links
 * first, in order, then links only the scoring group makes. Links weighing 0 are left out.
 */
export function weightedEdges(input: SynergyInput): WeightedEdge[] {
  const key = (from: string, to: string) => `${from}\u0000${to}`;
  const feedback = new Map(
    input.feedback.map((f) => [
      `${f.ruleId}\u0000${key(f.fromCardId, f.toCardId)}`,
      f,
    ]),
  );
  const defaults = new Map(SYNERGY_RULES.map((r) => [r.id, r.weight]));

  const edges = new Map<string, WeightedEdge>();
  for (const e of input.derived) {
    const weight = Math.max(
      ...e.reasons.map((id) => {
        const ruleWeight =
          input.ruleWeights[id] ?? defaults.get(id) ?? e.weight;
        const f = feedback.get(`${id}\u0000${key(e.from, e.to)}`);
        return f ? feedbackWeight(f, ruleWeight) : ruleWeight;
      }),
    );
    edges.set(key(e.from, e.to), {
      from: e.from,
      to: e.to,
      weight,
      bucket: e.engine ?? "reference",
      kind: "rule",
      traverse: e.traverse,
      reasons: e.reasons,
    });
  }
  for (const c of input.community) {
    const k = key(c.fromCardId, c.toCardId);
    const existing = edges.get(k);
    edges.set(
      k,
      existing
        ? {
            ...existing,
            weight: Math.max(existing.weight, c.weight),
            kind: "both",
          }
        : {
            from: c.fromCardId,
            to: c.toCardId,
            weight: c.weight,
            bucket: "community",
            kind: "community",
            traverse: false,
            reasons: [],
          },
    );
  }
  return [...edges.values()].filter((e) => e.weight > 0);
}

export function buildSynergyGraph(input: SynergyInput): SynergyGraph {
  const graph: SynergyGraph = new Map();
  const link = (card: string, l: SynergyLink) =>
    graph.set(card, [...(graph.get(card) ?? []), l]);
  for (const e of weightedEdges(input)) {
    link(e.from, { other: e.to, weight: e.weight, bucket: e.bucket });
    link(e.to, { other: e.from, weight: e.weight, bucket: e.bucket });
  }
  return graph;
}

/**
 * strength × Σ over engines min(1, Σ weight of links to picked cards in that engine).
 * strength is in value points (0–100 scale) per engine.
 */
export function synergyBonus(
  cardId: string,
  picked: Set<string>,
  graph: SynergyGraph,
  strength: number,
): number {
  if (strength <= 0 || picked.size === 0) return 0;
  const byBucket = new Map<string, number>();
  for (const l of graph.get(cardId) ?? []) {
    if (!picked.has(l.other)) continue;
    byBucket.set(l.bucket, (byBucket.get(l.bucket) ?? 0) + l.weight);
  }
  let total = 0;
  for (const sum of byBucket.values()) total += Math.min(1, sum);
  return Math.round(strength * total * 100) / 100;
}

const PITCHES = [1, 2, 3] as const;

/**
 * Like suggestCore, but greedy: locked cards first, then one card at a time, the best
 * candidate by value + bonus among pitches still short of their target. With no bonus it picks
 * the same cards as suggestCore. Ties go to the earlier candidate.
 */
export function fillWithSynergy(
  ranked: CoreCandidate[],
  c: CoreConstraints,
  bonus: (cardId: string, picked: Set<string>) => number,
): CoreSuggestion {
  const each = Math.max(1, Math.min(c.copiesEach, c.copyLimit));
  const quantity = new Map<string, number>();
  const picked = new Set<string>();
  for (const r of ranked) {
    const q = c.locked.get(r.variantId);
    if (q === undefined) continue;
    quantity.set(r.variantId, Math.min(q, r.limit ?? c.copyLimit));
    picked.add(r.cardId);
  }
  const filledFor = (pitch: number) =>
    ranked
      .filter((r) => r.pitch === pitch)
      .reduce((n, r) => n + (quantity.get(r.variantId) ?? 0), 0);
  const left = new Map<number, number>();
  for (const pitch of PITCHES) {
    const target = c.targets[pitch];
    if (target !== undefined) left.set(pitch, target - filledFor(pitch));
  }

  for (;;) {
    let best: CoreCandidate | null = null;
    let bestScore = -Infinity;
    for (const r of ranked) {
      if (r.pitch === null || (left.get(r.pitch) ?? 0) <= 0) continue;
      if (quantity.has(r.variantId) || c.removed.has(r.variantId)) continue;
      const score = r.value + bonus(r.cardId, picked);
      if (score > bestScore) {
        best = r;
        bestScore = score;
      }
    }
    if (!best) break;
    const room = left.get(best.pitch!)!;
    const q = Math.min(each, best.limit ?? c.copyLimit, room);
    quantity.set(best.variantId, q);
    left.set(best.pitch!, room - q);
    picked.add(best.cardId);
  }

  return {
    picks: ranked
      .filter((r) => quantity.has(r.variantId))
      .map((r) => ({
        ...r,
        quantity: quantity.get(r.variantId)!,
        locked: c.locked.has(r.variantId),
      })),
    byPitch: PITCHES.filter((p) => c.targets[p] !== undefined).map((pitch) => ({
      pitch,
      target: c.targets[pitch]!,
      filled: filledFor(pitch),
    })),
  };
}

// Discovery in the explorer (maintainer, 19 Oct 2026; explorer feature 2): packages, groups of
// cards that work as a unit, and hidden gems, low-rated cards linked strongly to high-rated
// ones. The thresholds are UNVERIFIED tuning, for the scoring group to adjust.
import type { CommunityRow } from "../ranking/rank.ts";
import type { WeightedEdge } from "../ranking/synergyCore.ts";

/**
 * Rules where a card names the cards it works with: they make packages. The role-fit rules
 * link whole groups (every Gate maker to every Gate target), so they don't.
 */
const NAMING_RULES = new Set([
  "tutor-finds",
  "enables-play-from-banish",
  "supports",
]);
/** Naming more cards than this is a group (Become the Arknight finds 118), not a package. */
const MAX_TARGETS = 15;
/** References naming mostly the same cards join one package. */
const OVERLAP = 0.5;

export interface Package {
  /** The first card that names the others. */
  id: string;
  /** The cards that name the others: what holds the package together. */
  referrers: string[];
  targets: string[];
  /** Each referrer and how it names them: a rule id, or "community" for the scoring group. */
  why: { card: string; rule: string }[];
}

const overlap = (a: Set<string>, b: Set<string>) => {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
};

/**
 * Packages: cards that name the same cards (search for them, play them from banish, support
 * them) together with those cards, plus the scoring group's own links. Largest first.
 */
export function packages(edges: WeightedEdge[]): Package[] {
  // Each card's references, by how it names them.
  const refs = new Map<
    string,
    { card: string; rule: string; to: Set<string> }
  >();
  for (const e of edges) {
    const rules = e.reasons.filter((r) => NAMING_RULES.has(r));
    if (e.kind !== "rule") rules.push("community");
    for (const rule of rules) {
      const key = `${e.from}\u0000${rule}`;
      const ref = refs.get(key) ?? {
        card: e.from,
        rule,
        to: new Set<string>(),
      };
      ref.to.add(e.to);
      refs.set(key, ref);
    }
  }

  const found: (Package & { targetSet: Set<string> })[] = [];
  for (const ref of refs.values()) {
    if (ref.to.size > MAX_TARGETS) continue;
    const into = found.find((p) => overlap(p.targetSet, ref.to) >= OVERLAP);
    if (into) {
      if (!into.referrers.includes(ref.card)) into.referrers.push(ref.card);
      for (const t of ref.to)
        if (!into.targetSet.has(t)) {
          into.targetSet.add(t);
          into.targets.push(t);
        }
      into.why.push({ card: ref.card, rule: ref.rule });
    } else {
      found.push({
        id: ref.card,
        referrers: [ref.card],
        targets: [...ref.to],
        targetSet: new Set(ref.to),
        why: [{ card: ref.card, rule: ref.rule }],
      });
    }
  }
  return found
    .map(({ targetSet: _, ...p }) => p)
    .sort(
      (a, b) =>
        b.referrers.length +
        b.targets.length -
        (a.referrers.length + a.targets.length),
    );
}

/**
 * A card's rating from the scoring group, 0–100: its best pitch's overall, averaged over the
 * sides rated. Ratings from fewer than `minRatingCount` people are left out.
 */
export function cardScores(
  rows: CommunityRow[],
  overallDimensionId: number,
  minRatingCount: number,
): Map<string, number> {
  const byVariant = new Map<string, { cardId: string; scores: number[] }>();
  for (const r of rows) {
    if (r.dimensionId !== overallDimensionId) continue;
    if (r.ratingCount < minRatingCount) continue;
    const v = byVariant.get(r.variantId) ?? { cardId: r.cardId, scores: [] };
    v.scores.push(r.score);
    byVariant.set(r.variantId, v);
  }
  const best = new Map<string, number>();
  for (const v of byVariant.values()) {
    const mean = v.scores.reduce((s, n) => s + n, 0) / v.scores.length;
    best.set(v.cardId, Math.max(best.get(v.cardId) ?? 0, mean));
  }
  return best;
}

export interface Gem {
  id: string;
  score: number;
  /** Highly rated cards it links to strongly, either way round, best rated first. */
  partners: string[];
  strength: number;
}

/**
 * Hidden gems: cards the scoring group rates low (below 6) that link strongly (0.6 or more)
 * to cards rated high (7 or more). Either an underrated card, or a link worth a second look.
 * Most such partners first, then the strongest links.
 */
export function hiddenGems(
  edges: WeightedEdge[],
  scores: Map<string, number>,
  { low = 60, high = 70, minWeight = 0.6, limit = 10 } = {},
): Gem[] {
  const partners = new Map<string, Map<string, number>>();
  const note = (gem: string, partner: string, weight: number) => {
    const g = scores.get(gem);
    const p = scores.get(partner);
    if (g === undefined || p === undefined) return;
    if (g >= low || p < high || weight < minWeight) return;
    const m = partners.get(gem) ?? new Map<string, number>();
    m.set(partner, Math.max(m.get(partner) ?? 0, weight));
    partners.set(gem, m);
  };
  for (const e of edges) {
    note(e.from, e.to, e.weight);
    note(e.to, e.from, e.weight);
  }
  return [...partners]
    .map(([id, m]) => ({
      id,
      score: scores.get(id)!,
      partners: [...m.keys()].sort((a, b) => scores.get(b)! - scores.get(a)!),
      strength:
        Math.round([...m.values()].reduce((s, w) => s + w, 0) * 100) / 100,
    }))
    .sort(
      (a, b) =>
        b.partners.length - a.partners.length || b.strength - a.strength,
    )
    .slice(0, limit);
}

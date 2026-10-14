// Turns raw database rows into input for computeCommunityScores.
import type { FringeSettings } from "./community.ts";
import type { Scorer, ScoringCard } from "./compute.ts";
import type { Side } from "./resolve.ts";

/** Roles whose reviewed scores count toward community scores. */
const SCORING_ROLES = new Set(["scorer", "curator", "admin"]);

export interface ScoringDbRows {
  profiles: { id: string; role: string }[];
  raterWeights: { user_id: string; rating_weight: string | number }[];
  cardReviews: { user_id: string; card_id: string }[];
  cardScores: {
    user_id: string;
    card_id: string;
    variant_id: string | null;
    side: string | null;
    dimension_id: number;
    score: number;
  }[];
  cards: { id: string; fringe: boolean }[];
  variants: { id: string; card_id: string }[];
  scoreDimensions: { id: number; key: string }[];
  appSettings: { key: string; value: unknown }[];
}

export function buildScoringInput(db: ScoringDbRows): {
  cards: ScoringCard[];
  dimensionIds: number[];
  fallbacks: Record<number, number>;
  scorers: Scorer[];
  settings: FringeSettings;
} {
  const weights = new Map(
    db.raterWeights.map((w) => [w.user_id, Number(w.rating_weight)]),
  );
  const scorers = db.profiles
    .filter((p) => SCORING_ROLES.has(p.role))
    .map((p): Scorer => ({
      userId: p.id,
      weight: weights.get(p.id) ?? 1,
      reviewedCardIds: db.cardReviews
        .filter((r) => r.user_id === p.id)
        .map((r) => r.card_id),
      scores: db.cardScores
        .filter((s) => s.user_id === p.id)
        .map((s) => ({
          cardId: s.card_id,
          variantId: s.variant_id,
          side: s.side as Side | null,
          dimensionId: s.dimension_id,
          score: s.score,
        })),
    }));

  const variantsByCard = new Map<string, string[]>();
  for (const v of db.variants) {
    variantsByCard.set(v.card_id, [
      ...(variantsByCard.get(v.card_id) ?? []),
      v.id,
    ]);
  }

  const setting = (key: string) =>
    Number(db.appSettings.find((s) => s.key === key)?.value);

  return {
    cards: db.cards.map((c) => ({
      id: c.id,
      fringe: c.fringe,
      variantIds: variantsByCard.get(c.id) ?? [],
    })),
    dimensionIds: db.scoreDimensions.map((d) => d.id),
    fallbacks: fallbacksFor(db.scoreDimensions),
    scorers,
    settings: {
      fringeDefault: setting("fringe_default"),
      fringeK: setting("fringe_k"),
    },
  };
}

/** README "Floor, ceiling and overall": a blank floor or ceiling resolves as overall. */
export function fallbacksFor(
  dimensions: { id: number; key: string }[],
): Record<number, number> {
  const overall = dimensions.find((d) => d.key === "overall");
  if (!overall) return {};
  return Object.fromEntries(
    dimensions
      .filter((d) => d.key === "floor" || d.key === "ceiling")
      .map((d) => [d.id, overall.id]),
  );
}

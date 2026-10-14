// The community score job's logic, independent of the database.
import { communityScore, type FringeSettings } from "./community.ts";
import { resolveScore, type ScoreRow, type Side } from "./resolve.ts";

export interface ScoringCard {
  id: string;
  fringe: boolean;
  variantIds: string[];
}

export interface Scorer {
  userId: string;
  /** Hidden rating_weight; server-side only. */
  weight: number;
  /** Cards this scorer has marked reviewed. Scores on other cards are drafts. */
  reviewedCardIds: string[];
  scores: (ScoreRow & { cardId: string })[];
}

export interface CommunityRow {
  cardId: string;
  variantId: string;
  side: Side;
  dimensionId: number;
  score: number;
  ratingCount: number;
  totalWeight: number;
}

const SIDES: Side[] = ["forsaken", "usurper"];

export function computeCommunityScores(input: {
  cards: ScoringCard[];
  dimensionIds: number[];
  scorers: Scorer[];
  settings: FringeSettings;
}): CommunityRow[] {
  const rows: CommunityRow[] = [];
  for (const card of input.cards) {
    const reviewers = input.scorers
      .filter((s) => s.reviewedCardIds.includes(card.id))
      .map((s) => ({
        weight: s.weight,
        scores: s.scores.filter((r) => r.cardId === card.id),
      }));
    if (reviewers.length === 0) continue;

    for (const variantId of card.variantIds) {
      for (const side of SIDES) {
        for (const dimensionId of input.dimensionIds) {
          const ratings = reviewers.map((r) => ({
            weight: r.weight,
            score: resolveScore(
              r.scores,
              { variantId, side, dimensionId },
              true,
            )!,
          }));
          const result = communityScore(ratings, {
            fringe: card.fringe,
            settings: input.settings,
          });
          if (result) {
            rows.push({
              cardId: card.id,
              variantId,
              side,
              dimensionId,
              ...result,
            });
          }
        }
      }
    }
  }
  return rows;
}

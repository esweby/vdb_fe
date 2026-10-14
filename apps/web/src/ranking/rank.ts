// The ranking behind the suggested core (README "Suggested core" and "Ranking").
// Value = the variant's floor, overall and ceiling, tilted by the user's risk setting.
import { resolveScore, type Side } from "@vdb/scoring";
import type { Dimension, ScoreRow } from "../scoring/scoreRepository.ts";

export interface CommunityRow {
  cardId: string;
  variantId: string;
  side: Side;
  dimensionId: number;
  score: number;
  ratingCount: number;
}

export interface RankableVariant {
  cardId: string;
  variantId: string;
  name: string;
  pitch: number | null;
}

export interface RankingInput {
  variants: RankableVariant[];
  /** Must include floor, ceiling and overall (README "Floor, ceiling and overall"). */
  dimensions: Dimension[];
  community: CommunityRow[];
  /** The signed-in user's scores; only cards they've reviewed count. */
  mine?: {
    rows: (ScoreRow & { cardId: string })[];
    reviewedCardIds: Set<string>;
  };
  /** −100 = rank by floor (consistent), 0 = overall, 100 = ceiling (high-roll) */
  risk: number;
  /** 0 = only my scores, 100 = only community scores */
  sourceBlend: number;
  /** 0 = Forsaken, 100 = Usurper */
  sideFocus: number;
  minRatingCount: number;
}

export type Ratings = { floor: number; ceiling: number; overall: number };

export interface RankedVariant extends RankableVariant {
  /** 0–100 */
  value: number;
  /** The blended floor, ceiling and overall used */
  parts: Ratings;
  /** Community rating count (people); 0 when ranked on my scores only. */
  ratingCount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const SIDES: Side[] = ["forsaken", "usurper"];
const KEYS = ["floor", "ceiling", "overall"] as const;

/** README "Ranking": S = O + max(r,0)(C − O) + min(r,0)(O − F), with r in [−1, 1]. */
export function tilt(ratings: Ratings, risk: number): number {
  const r = Math.max(-1, Math.min(1, risk / 100));
  const { floor: f, ceiling: c, overall: o } = ratings;
  return o + Math.max(r, 0) * (c - o) + Math.min(r, 0) * (o - f);
}

export function rankVariants(input: RankingInput): RankedVariant[] {
  const id = (key: string) => input.dimensions.find((d) => d.key === key)?.id;
  const overallId = id("overall");
  if (overallId === undefined) return [];
  const ids = {
    floor: id("floor") ?? overallId,
    ceiling: id("ceiling") ?? overallId,
    overall: overallId,
  };

  const communityByKey = new Map(
    input.community.map((r) => [
      `${r.variantId}|${r.side}|${r.dimensionId}`,
      r,
    ]),
  );
  const myRowsByCard = new Map<string, ScoreRow[]>();
  for (const r of input.mine?.rows ?? []) {
    myRowsByCard.set(r.cardId, [...(myRowsByCard.get(r.cardId) ?? []), r]);
  }
  const b = input.sourceBlend / 100;
  const f = input.sideFocus / 100;

  const ranked: RankedVariant[] = [];
  for (const v of input.variants) {
    const reviewedByMe = input.mine?.reviewedCardIds.has(v.cardId) ?? false;
    const anyCommunity = communityByKey.get(
      `${v.variantId}|forsaken|${overallId}`,
    );
    const communityOk =
      !!anyCommunity && anyCommunity.ratingCount >= input.minRatingCount;
    if (!communityOk && !reviewedByMe) continue;

    const parts = {} as Ratings;
    for (const key of KEYS) {
      const dimensionId = ids[key];
      const perSide = SIDES.map((side) => {
        // Community floor and ceiling are already resolved by the job; a missing row is overall.
        const c = communityOk
          ? (
              communityByKey.get(`${v.variantId}|${side}|${dimensionId}`) ??
              communityByKey.get(`${v.variantId}|${side}|${overallId}`)
            )?.score
          : undefined;
        const m = reviewedByMe
          ? (resolveScore(
              myRowsByCard.get(v.cardId) ?? [],
              { variantId: v.variantId, side, dimensionId },
              true,
              {
                fallbackDimensionId: key === "overall" ? undefined : overallId,
              },
            ) ?? undefined)
          : undefined;
        if (c !== undefined && m !== undefined) return (1 - b) * m + b * c;
        return c ?? m ?? 0;
      });
      parts[key] = round2((1 - f) * perSide[0]! + f * perSide[1]!);
    }

    ranked.push({
      ...v,
      value: round2(tilt(parts, input.risk)),
      parts,
      ratingCount: communityOk ? anyCommunity.ratingCount : 0,
    });
  }

  return ranked.sort(
    (x, y) => y.value - x.value || x.name.localeCompare(y.name),
  );
}

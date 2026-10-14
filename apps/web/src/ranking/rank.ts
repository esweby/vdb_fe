// The ranking behind the suggested core (README "Suggested core").
// Value = weighted average of a variant's dimension scores, using the user's priorities.
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
  dimensions: Dimension[];
  community: CommunityRow[];
  /** The signed-in user's scores; only cards they've reviewed count. */
  mine?: {
    rows: (ScoreRow & { cardId: string })[];
    reviewedCardIds: Set<string>;
  };
  /** dimension key -> weight, 0–100 */
  priorities: Record<string, number>;
  /** 0 = only my scores, 100 = only community scores */
  sourceBlend: number;
  /** 0 = Forsaken, 100 = Usurper */
  sideFocus: number;
  minRatingCount: number;
}

export interface RankedVariant extends RankableVariant {
  /** 0–100 */
  value: number;
  /** dimension key -> the blended score used */
  parts: Record<string, number>;
  /** Community rating count (people); 0 when ranked on my scores only. */
  ratingCount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const SIDES: Side[] = ["forsaken", "usurper"];

export function rankVariants(input: RankingInput): RankedVariant[] {
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
  const totalWeight = input.dimensions.reduce(
    (sum, d) => sum + (input.priorities[d.key] ?? 0),
    0,
  );

  const ranked: RankedVariant[] = [];
  for (const v of input.variants) {
    const reviewedByMe = input.mine?.reviewedCardIds.has(v.cardId) ?? false;
    const anyCommunity =
      input.community.length > 0 &&
      communityByKey.get(`${v.variantId}|forsaken|${input.dimensions[0]?.id}`);
    const communityOk =
      !!anyCommunity && anyCommunity.ratingCount >= input.minRatingCount;
    if (!communityOk && !reviewedByMe) continue;

    const parts: Record<string, number> = {};
    for (const d of input.dimensions) {
      const perSide = SIDES.map((side) => {
        const c = communityOk
          ? communityByKey.get(`${v.variantId}|${side}|${d.id}`)?.score
          : undefined;
        const m = reviewedByMe
          ? (resolveScore(
              myRowsByCard.get(v.cardId) ?? [],
              { variantId: v.variantId, side, dimensionId: d.id },
              true,
            ) ?? undefined)
          : undefined;
        if (c !== undefined && m !== undefined) return (1 - b) * m + b * c;
        return c ?? m ?? 0;
      });
      parts[d.key] = round2((1 - f) * perSide[0]! + f * perSide[1]!);
    }

    const value =
      totalWeight === 0
        ? 0
        : input.dimensions.reduce(
            (sum, d) => sum + (input.priorities[d.key] ?? 0) * parts[d.key]!,
            0,
          ) / totalWeight;
    ranked.push({
      ...v,
      value: round2(value),
      parts,
      ratingCount: communityOk ? anyCommunity.ratingCount : 0,
    });
  }

  return ranked.sort(
    (x, y) => y.value - x.value || x.name.localeCompare(y.name),
  );
}

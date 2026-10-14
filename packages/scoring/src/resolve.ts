// Resolves one scorer's score for a variant, side and dimension.
// README "Reviews and blank scores": the most specific score wins; a blank uses the
// level above; a blank at the top level is 0 on a reviewed card and unknown otherwise.
// README "Floor, ceiling and overall": with a fallback, a dimension that's blank at every
// level resolves as the fallback instead (a blank floor or ceiling means "same as overall").

export type Side = "forsaken" | "usurper";

export interface ScoreRow {
  /** null = card level */
  variantId: string | null;
  /** null = both sides */
  side: Side | null;
  dimensionId: number;
  /** 0–100. An explicit "not relevant" is 0. */
  score: number;
}

export interface ScoreTarget {
  variantId: string;
  side: Side;
  dimensionId: number;
}

export function resolveScore(
  rows: ScoreRow[],
  target: ScoreTarget,
  reviewed: boolean,
  options: { fallbackDimensionId?: number } = {},
): number | null {
  const levels: [string | null, Side | null][] = [
    [target.variantId, target.side],
    [target.variantId, null],
    [null, target.side],
    [null, null],
  ];
  for (const [variantId, side] of levels) {
    const match = rows.find(
      (r) =>
        r.dimensionId === target.dimensionId &&
        r.variantId === variantId &&
        r.side === side,
    );
    if (match) return match.score;
  }
  if (options.fallbackDimensionId !== undefined) {
    return resolveScore(
      rows,
      { ...target, dimensionId: options.fallbackDimensionId },
      reviewed,
    );
  }
  return reviewed ? 0 : null;
}

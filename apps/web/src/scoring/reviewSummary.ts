// What a review will count: every pitch and side on every dimension, and where each value
// comes from (README "Mark reviewed"). Blanks count as 0 once the card is reviewed.
import type { Side } from "@vdb/scoring";
import type { Dimension, ScoreRow } from "./scoreRepository.ts";

export type Source = "set" | "inherited" | "not_relevant" | "blank";

export interface SummaryCell {
  dimensionId: number;
  variantId: string;
  pitch: number | null;
  side: Side;
  value: number;
  source: Source;
}

const SIDES: Side[] = ["forsaken", "usurper"];

export function reviewSummary(
  rows: ScoreRow[],
  dimensions: Dimension[],
  variants: { id: string; pitch: number | null }[],
): SummaryCell[] {
  const find = (
    dimensionId: number,
    variantId: string | null,
    side: Side | null,
  ) =>
    rows.find(
      (r) =>
        r.dimensionId === dimensionId &&
        r.variantId === variantId &&
        r.side === side,
    )?.score;

  return dimensions.flatMap((d) =>
    variants.flatMap((v) =>
      SIDES.map((side): SummaryCell => {
        const base = {
          dimensionId: d.id,
          variantId: v.id,
          pitch: v.pitch,
          side,
        };
        const own = find(d.id, v.id, side);
        if (own !== undefined) {
          return {
            ...base,
            value: own,
            source: own === 0 ? "not_relevant" : "set",
          };
        }
        for (const [variantId, s] of [
          [v.id, null],
          [null, side],
          [null, null],
        ] as const) {
          const value = find(d.id, variantId, s);
          if (value !== undefined)
            return { ...base, value, source: "inherited" };
        }
        return { ...base, value: 0, source: "blank" };
      }),
    ),
  );
}

export interface Fix {
  dimensionId: number;
  label: string;
  score: number;
  description: string;
}

/**
 * The blank-pitch trap: a dimension scored somewhere, but with blanks that will count as 0.
 * Offers to set the highest score at card level so the blanks inherit it.
 */
export function suggestedFixes(
  rows: ScoreRow[],
  dimensions: Dimension[],
  variants: { id: string; pitch: number | null }[],
): Fix[] {
  const summary = reviewSummary(rows, dimensions, variants);
  return dimensions.flatMap((d) => {
    const hasBlank = summary.some(
      (c) => c.dimensionId === d.id && c.source === "blank",
    );
    const best = Math.max(
      0,
      ...rows.filter((r) => r.dimensionId === d.id).map((r) => r.score),
    );
    if (!hasBlank || best === 0) return [];
    return [
      {
        dimensionId: d.id,
        label: d.label,
        score: best,
        description: `Use ${best} for the whole card, so blank pitches and sides inherit it`,
      },
    ];
  });
}

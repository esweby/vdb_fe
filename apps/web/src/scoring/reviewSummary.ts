// What a review will count: every pitch and side on every dimension, and where each value
// comes from (README "Mark reviewed"). Blanks count as 0 once the card is reviewed, except a
// blank floor or ceiling, which counts as the same as overall (README "Floor, ceiling and overall").
import type { Side } from "@vdb/scoring";
import { formatScore } from "./scoreFormat.ts";
import type { Dimension, ScoreRow } from "./scoreRepository.ts";

export type Source =
  "set" | "inherited" | "not_relevant" | "blank" | "same_as_overall";

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

  const overall = dimensions.find((d) => d.key === "overall");
  const fallsBack = (d: Dimension) =>
    !!overall && (d.key === "floor" || d.key === "ceiling");

  const cell = (
    d: Dimension,
    v: { id: string; pitch: number | null },
    side: Side,
  ): SummaryCell => {
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
      if (value !== undefined) return { ...base, value, source: "inherited" };
    }
    if (fallsBack(d)) {
      const same = cell(overall!, v, side);
      return { ...base, value: same.value, source: "same_as_overall" };
    }
    return { ...base, value: 0, source: "blank" };
  };

  return dimensions.flatMap((d) =>
    variants.flatMap((v) => SIDES.map((side) => cell(d, v, side))),
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

export interface SummaryRow {
  /** "Every pitch and side", "Red", "Yellow, Blue", "Red, Forsaken", "Both sides"… */
  where: string;
  /** "80", "0 · no score, counts as 0", "70 · same as overall", "0 · not relevant" */
  value: string;
  /** Worth a second look: a blank that counts as 0 (or, when asked, a same-as-overall). */
  attention: boolean;
}

const SIDE_NAME: Record<Side, string> = {
  forsaken: "Forsaken",
  usurper: "Usurper",
};

function valueText(cell: SummaryCell): string {
  switch (cell.source) {
    case "blank":
      return "0 · no score, counts as 0";
    case "not_relevant":
      return "0 · not relevant";
    case "same_as_overall":
      return `${formatScore(cell.value)} · same as overall`;
    default:
      return formatScore(cell.value);
  }
}

/**
 * One rating's summary, said once: identical pitches and sides fold together ("Every pitch
 * and side: 80", "Yellow, Blue: 0 · no score"), and sides only split when they differ.
 */
export function summaryRows(
  cells: SummaryCell[],
  variants: { id: string; pitch: number | null }[],
  options: { flagSameAsOverall?: boolean } = {},
): SummaryRow[] {
  const multiPitch = variants.length > 1;
  const pitchLabel = (pitch: number | null) => {
    if (pitch === 1) return "Red";
    if (pitch === 2) return "Yellow";
    if (pitch === 3) return "Blue";
    return pitch === null ? "No pitch" : `Pitch ${pitch}`;
  };
  const keyOf = (c: SummaryCell) => `${c.value}|${c.source}`;

  type Entry = { pitch: string; side: string | null; cell: SummaryCell };
  const entries: Entry[] = variants.flatMap((v): Entry[] => {
    const forsaken = cells.find(
      (c) => c.variantId === v.id && c.side === "forsaken",
    );
    const usurper = cells.find(
      (c) => c.variantId === v.id && c.side === "usurper",
    );
    if (!forsaken || !usurper) return [];
    return keyOf(forsaken) === keyOf(usurper)
      ? [{ pitch: pitchLabel(v.pitch), side: null, cell: forsaken }]
      : [
          {
            pitch: pitchLabel(v.pitch),
            side: SIDE_NAME.forsaken,
            cell: forsaken,
          },
          {
            pitch: pitchLabel(v.pitch),
            side: SIDE_NAME.usurper,
            cell: usurper,
          },
        ];
  });

  // Fold together pitches with the same value on the same side(s), keeping first-seen order.
  const groups: {
    side: string | null;
    cell: SummaryCell;
    pitches: string[];
  }[] = [];
  for (const e of entries) {
    const group = groups.find(
      (g) => g.side === e.side && keyOf(g.cell) === keyOf(e.cell),
    );
    if (group) group.pitches.push(e.pitch);
    else groups.push({ side: e.side, cell: e.cell, pitches: [e.pitch] });
  }

  return groups.map((g) => {
    const where =
      groups.length === 1 && g.side === null
        ? multiPitch
          ? "Every pitch and side"
          : "Both sides"
        : [multiPitch ? g.pitches.join(", ") : null, g.side]
            .filter(Boolean)
            .join(", ") || "Both sides";
    return {
      where,
      value: valueText(g.cell),
      attention:
        g.cell.source === "blank" ||
        (!!options.flagSameAsOverall && g.cell.source === "same_as_overall"),
    };
  });
}

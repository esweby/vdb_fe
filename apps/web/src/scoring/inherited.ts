// What a score cell shows: its own value, or what it inherits from the level above
// (README "Reviews and blank scores"). Display only; resolution itself is @vdb/scoring.
import type { ScoreKey, ScoreRow } from "./scoreRepository.ts";

function ancestors(target: ScoreKey): [string | null, ScoreKey["side"]][] {
  const { variantId, side } = target;
  if (variantId && side)
    return [
      [variantId, null],
      [null, side],
      [null, null],
    ];
  if (variantId || side) return [[null, null]];
  return [];
}

export function cellValue(
  rows: ScoreRow[],
  target: ScoreKey,
): { own: number | null; inherited: number | null } {
  const find = (variantId: string | null, side: ScoreKey["side"]) =>
    rows.find(
      (r) =>
        r.dimensionId === target.dimensionId &&
        r.variantId === variantId &&
        r.side === side,
    )?.score;
  const own = find(target.variantId, target.side) ?? null;
  let inherited: number | null = null;
  for (const [variantId, side] of ancestors(target)) {
    const value = find(variantId, side);
    if (value !== undefined) {
      inherited = value;
      break;
    }
  }
  return { own, inherited };
}

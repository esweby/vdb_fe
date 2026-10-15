// Ranking settings <-> URL search params, so a board and its core can be shared or bookmarked.

export type BoardOrder = "score" | "fits";

export interface RankingSettings {
  /** −100 (consistent: floor) to 100 (high-roll: ceiling); 0 = overall */
  risk: number;
  sourceBlend: number;
  sideFocus: number;
  /** Lanes by value, or by how many core cards a card fits with first. */
  order: BoardOrder;
  /** The core: variant id → copies. */
  core: Record<string, number>;
}

export interface RankingSearch {
  risk?: number;
  blend?: number;
  side?: number;
  order?: BoardOrder;
  core?: Record<string, number>;
}

/** README "Ranking" presets. UNVERIFIED values, for the scoring group to confirm. */
export const RISK_PRESETS = [
  { label: "Consistent", risk: -50 },
  { label: "Balanced", risk: 0 },
  { label: "High-roll", risk: 50 },
] as const;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
const num = (v: unknown) =>
  typeof v === "number" ? v : typeof v === "string" && v ? Number(v) : NaN;

/** Whole, positive copies only; the copy limit is applied where cards are added. */
function readCore(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(
    Object.entries(v).filter(
      (e): e is [string, number] =>
        typeof e[1] === "number" && Number.isInteger(e[1]) && e[1] > 0,
    ),
  );
}

export function readRankingSearch(
  search: Partial<Record<keyof RankingSearch, unknown>>,
): RankingSettings {
  const or = (v: unknown, fallback: number, min: number, max: number) =>
    Number.isFinite(num(v)) ? clamp(Math.round(num(v)), min, max) : fallback;
  return {
    risk: or(search.risk, 0, -100, 100),
    sourceBlend: or(search.blend, 100, 0, 100),
    sideFocus: or(search.side, 50, 0, 100),
    order: search.order === "fits" ? "fits" : "score",
    core: readCore(search.core),
  };
}

/** Only non-default values are written, to keep URLs short. */
export function writeRankingSearch(s: RankingSettings): RankingSearch {
  return {
    ...(s.risk !== 0 ? { risk: s.risk } : {}),
    ...(s.sourceBlend !== 100 ? { blend: s.sourceBlend } : {}),
    ...(s.sideFocus !== 50 ? { side: s.sideFocus } : {}),
    ...(s.order !== "score" ? { order: s.order } : {}),
    ...(Object.keys(s.core).length ? { core: s.core } : {}),
  };
}

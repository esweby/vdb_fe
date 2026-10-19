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
  /** Preferences (preferences.ts): id → 0 (avoid) to 100 (prefer); missing = 50. */
  prefs: Record<string, number>;
  /**
   * Synergy strength, 0 (off: rank by value alone) to 100. Fill to targets adds up to
   * synergy / 10 value points per engine for cards that work with ones already in the core.
   * Off by default until the scoring group agrees one (docs/synergy-rules.md).
   */
  synergy: number;
}

export interface RankingSearch {
  risk?: number;
  blend?: number;
  side?: number;
  order?: BoardOrder;
  core?: Record<string, number>;
  pref?: Record<string, number>;
  syn?: number;
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

/** 0–100, leaving out neutral (50) and anything that isn't a number. */
function readPrefs(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(
    Object.entries(v)
      .filter((e): e is [string, number] => typeof e[1] === "number")
      .map(([k, n]) => [k, clamp(Math.round(n), 0, 100)] as const)
      .filter(([, n]) => n !== 50),
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
    prefs: readPrefs(search.pref),
    synergy: or(search.syn, 0, 0, 100),
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
    ...(Object.keys(s.prefs).length ? { pref: s.prefs } : {}),
    ...(s.synergy !== 0 ? { syn: s.synergy } : {}),
  };
}

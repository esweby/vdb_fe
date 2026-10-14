// Ranking settings <-> URL search params, so a ranking can be shared or bookmarked.

export interface RankingSettings {
  /** −100 (consistent: floor) to 100 (high-roll: ceiling); 0 = overall */
  risk: number;
  sourceBlend: number;
  sideFocus: number;
  coreSize: number;
  /** variant ids */
  pinned: string[];
  excluded: string[];
}

export interface RankingSearch {
  risk?: number;
  blend?: number;
  side?: number;
  core?: number;
  pin?: string[];
  ex?: string[];
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
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function readRankingSearch(
  search: Partial<Record<keyof RankingSearch, unknown>>,
): RankingSettings {
  const or = (v: unknown, fallback: number, min: number, max: number) =>
    Number.isFinite(num(v)) ? clamp(Math.round(num(v)), min, max) : fallback;
  return {
    risk: or(search.risk, 0, -100, 100),
    sourceBlend: or(search.blend, 100, 0, 100),
    sideFocus: or(search.side, 50, 0, 100),
    coreSize: or(search.core, 20, 1, 80),
    pinned: strings(search.pin),
    excluded: strings(search.ex),
  };
}

/** Only non-default values are written, to keep URLs short. */
export function writeRankingSearch(s: RankingSettings): RankingSearch {
  return {
    ...(s.risk !== 0 ? { risk: s.risk } : {}),
    ...(s.sourceBlend !== 100 ? { blend: s.sourceBlend } : {}),
    ...(s.sideFocus !== 50 ? { side: s.sideFocus } : {}),
    ...(s.coreSize !== 20 ? { core: s.coreSize } : {}),
    ...(s.pinned.length ? { pin: s.pinned } : {}),
    ...(s.excluded.length ? { ex: s.excluded } : {}),
  };
}

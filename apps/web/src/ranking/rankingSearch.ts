// Ranking settings <-> URL search params, so a ranking can be shared or bookmarked.

export interface RankingSettings {
  /** dimension key -> weight, 0–100 */
  priorities: Record<string, number>;
  sourceBlend: number;
  sideFocus: number;
  coreSize: number;
  /** variant ids */
  pinned: string[];
  excluded: string[];
}

export interface RankingSearch {
  w?: string[];
  blend?: number;
  side?: number;
  core?: number;
  pin?: string[];
  ex?: string[];
}

const DEFAULT_WEIGHT = 50;
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
const num = (v: unknown) =>
  typeof v === "number" ? v : typeof v === "string" && v ? Number(v) : NaN;
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function readRankingSearch(
  search: Record<string, unknown>,
  dimensionKeys: string[],
): RankingSettings {
  const priorities = Object.fromEntries(
    dimensionKeys.map((k) => [k, DEFAULT_WEIGHT]),
  );
  for (const entry of strings(search.w)) {
    const [key, raw] = entry.split(":");
    const value = Number(raw);
    if (key && key in priorities && raw !== "" && Number.isFinite(value)) {
      priorities[key] = clamp(value, 0, 100);
    }
  }
  const or = (v: unknown, fallback: number, min: number, max: number) =>
    Number.isFinite(num(v)) ? clamp(Math.round(num(v)), min, max) : fallback;
  return {
    priorities,
    sourceBlend: or(search.blend, 100, 0, 100),
    sideFocus: or(search.side, 50, 0, 100),
    coreSize: or(search.core, 20, 1, 80),
    pinned: strings(search.pin),
    excluded: strings(search.ex),
  };
}

/** Only non-default values are written, to keep URLs short. */
export function writeRankingSearch(s: RankingSettings): RankingSearch {
  const w = Object.entries(s.priorities)
    .filter(([, v]) => v !== DEFAULT_WEIGHT)
    .map(([k, v]) => `${k}:${v}`);
  return {
    ...(w.length ? { w } : {}),
    ...(s.sourceBlend !== 100 ? { blend: s.sourceBlend } : {}),
    ...(s.sideFocus !== 50 ? { side: s.sideFocus } : {}),
    ...(s.coreSize !== 20 ? { core: s.coreSize } : {}),
    ...(s.pinned.length ? { pin: s.pinned } : {}),
    ...(s.excluded.length ? { ex: s.excluded } : {}),
  };
}

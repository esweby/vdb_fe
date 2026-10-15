// Flags an overall outside [floor, ceiling] (README "Floor, ceiling and overall").
// It's a prompt to check, not a rule: the form never rejects it.
import { resolveScore, type Side } from "@vdb/scoring";
import { pitchName } from "../cards/pitch.ts";
import type { Dimension, ScoreRow } from "./scoreRepository.ts";

const SIDES: Side[] = ["forsaken", "usurper"];
const SIDE_NAME: Record<Side, string> = {
  forsaken: "Forsaken",
  usurper: "Usurper",
};

export function spreadWarnings(
  rows: ScoreRow[],
  dimensions: Dimension[],
  variants: { id: string; pitch: number | null }[],
): string[] {
  const byKey = (key: string) => dimensions.find((d) => d.key === key);
  const [floor, ceiling, overall] = [
    byKey("floor"),
    byKey("ceiling"),
    byKey("overall"),
  ];
  if (!floor || !ceiling || !overall) return [];

  const found: { where: string; message: string }[] = [];
  for (const v of variants) {
    for (const side of SIDES) {
      const at = (dimensionId: number, fallback?: number) =>
        resolveScore(rows, { variantId: v.id, side, dimensionId }, false, {
          fallbackDimensionId: fallback,
        });
      const o = at(overall.id);
      if (o === null) continue;
      const f = at(floor.id, overall.id);
      const c = at(ceiling.id, overall.id);
      const where = `${variants.length > 1 ? `${pitchName(v.pitch)}, ` : ""}${SIDE_NAME[side]}`;
      if (c !== null && o > c) {
        found.push({
          where,
          message: `Overall (${o}) is above the ceiling (${c}). That's allowed, but check it.`,
        });
      }
      if (f !== null && o < f) {
        found.push({
          where,
          message: `Overall (${o}) is below the floor (${f}). That's allowed, but check it.`,
        });
      }
    }
  }
  const messages = [...new Set(found.map((x) => x.message))];
  // The same everywhere (usually card-level scores): say it once.
  const everywhere = variants.length * SIDES.length;
  return messages.flatMap((m) => {
    const places = found.filter((x) => x.message === m);
    return places.length === everywhere
      ? [m]
      : places.map((x) => `${x.where}: ${m}`);
  });
}

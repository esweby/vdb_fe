// Pitches are named by colour, as players say them: "Red", not "pitch 1".
const NAMES: Record<number, string> = { 1: "Red", 2: "Yellow", 3: "Blue" };

export function pitchName(pitch: number | null): string {
  if (pitch === null) return "No pitch";
  return NAMES[pitch] ?? `Pitch ${pitch}`;
}

/**
 * Red first, then yellow, then blue, then no pitch. A card opens on its first version, and
 * opening on blue may sway how scorers rate it (maintainer, 19 Oct 2026).
 */
export function redFirst<T extends { pitch: number | null }>(
  variants: T[],
): T[] {
  return [...variants].sort(
    (a, b) => (a.pitch ?? Infinity) - (b.pitch ?? Infinity),
  );
}

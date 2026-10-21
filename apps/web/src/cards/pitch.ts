// Pitches are named by colour, as players say them: "Red", not "pitch 1".
// Pitch 4 is purple: Soul of Existence, the one card with it (dataset colour "Purple").
const NAMES: Record<number, string> = {
  1: "Red",
  2: "Yellow",
  3: "Blue",
  4: "Purple",
};

export function pitchName(pitch: number | null): string {
  if (pitch === null) return "No pitch";
  return NAMES[pitch] ?? `Pitch ${pitch}`;
}

/**
 * The pitches a pitch mix shows: red, yellow and blue always, purple only when there is some,
 * so decks without Soul of Existence look as they always have.
 */
export function pitchesShown(counts: Record<number, number>): number[] {
  return (counts[4] ?? 0) > 0 ? [1, 2, 3, 4] : [1, 2, 3];
}

/**
 * Red first, then yellow, blue and purple, then no pitch. A card opens on its first version, and
 * opening on blue may sway how scorers rate it (maintainer, 19 Oct 2026).
 */
export function redFirst<T extends { pitch: number | null }>(
  variants: T[],
): T[] {
  return [...variants].sort(
    (a, b) => (a.pitch ?? Infinity) - (b.pitch ?? Infinity),
  );
}

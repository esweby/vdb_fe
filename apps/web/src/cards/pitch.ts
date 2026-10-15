// Pitches are named by colour, as players say them: "Red", not "pitch 1".
const NAMES: Record<number, string> = { 1: "Red", 2: "Yellow", 3: "Blue" };

export function pitchName(pitch: number | null): string {
  if (pitch === null) return "No pitch";
  return NAMES[pitch] ?? `Pitch ${pitch}`;
}

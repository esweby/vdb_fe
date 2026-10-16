/**
 * A stored score (0-100) as people see it: out of 10, with one decimal for averages ("8.5").
 * Storage, community scores and the ranking maths stay 0-100; only the display changes
 * (scoring group feedback, 16 Oct 2026).
 */
export function formatScore(score: number): string {
  const tenths = Math.round(score) / 10;
  return String(Math.round(tenths * 10) / 10);
}

// Score resolution shared by the web app and the community-scores Edge Function.
// Relative imports use explicit .ts extensions so Deno can resolve them.
// Placeholder for the M0 spike; the real rules arrive in M3.

export const SCORING_VERSION = "0.0.0";

export function normalise(score: number): number {
  return score / 100;
}

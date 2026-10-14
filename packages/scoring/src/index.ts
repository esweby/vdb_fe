// Score resolution shared by the web app and the community-scores Edge Function.
// Relative imports use explicit .ts extensions so Deno can resolve them.

export const SCORING_VERSION = "0.1.0";

export function normalise(score: number): number {
  return score / 100;
}

export * from "./community.ts";
export * from "./compute.ts";
export * from "./resolve.ts";

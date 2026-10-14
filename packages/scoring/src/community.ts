// Combines resolved scores into a community score.
// README "Rater weighting" and "Fringe cards": a weighted average; fringe cards start from
// a default worth k ratings. Rating count is people and never includes the default.

export interface Rating {
  score: number;
  weight: number;
}

export interface FringeSettings {
  fringeDefault: number;
  fringeK: number;
}

export interface CommunityScore {
  score: number;
  ratingCount: number;
  totalWeight: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function communityScore(
  ratings: Rating[],
  options: { fringe: boolean; settings: FringeSettings },
): CommunityScore | null {
  if (ratings.length === 0) return null;
  const k = options.fringe ? options.settings.fringeK : 0;
  const prior = options.fringe ? k * options.settings.fringeDefault : 0;
  const weight = ratings.reduce((sum, r) => sum + r.weight, 0);
  const weighted = ratings.reduce((sum, r) => sum + r.score * r.weight, 0);
  const totalWeight = weight + k;
  return {
    score: round2((prior + weighted) / totalWeight),
    ratingCount: ratings.length,
    totalWeight,
  };
}

import type { CommunityRow } from "../ranking/rank.ts";

/**
 * Community ratings for the sample cards: floor (1), ceiling (2) and overall (3).
 * Become the Shadow Lord is swingy (it needs a Shadow card to banish); the rest are steady.
 */
export function sampleCommunity(): CommunityRow[] {
  const rows: CommunityRow[] = [];
  const add = (
    cardId: string,
    variantId: string,
    floor: number,
    ceiling: number,
    overall: number,
    ratingCount = 3,
  ) => {
    for (const side of ["forsaken", "usurper"] as const) {
      for (const [dimensionId, score] of [
        [1, floor],
        [2, ceiling],
        [3, overall],
      ] as const) {
        rows.push({ cardId, variantId, side, dimensionId, score, ratingCount });
      }
    }
  };
  add("card-hocus-pocus", "hp1", 50, 50, 50);
  add("card-hocus-pocus", "hp2", 40, 40, 40);
  add("card-hocus-pocus", "hp3", 30, 30, 30);
  add("card-become-the-shadow-lord", "bsl3", 20, 100, 70);
  add("card-nebula-blade", "nb", 40, 40, 40);
  // Fate Foreseen: nobody has rated it.
  return rows;
}

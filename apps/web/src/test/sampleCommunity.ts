import type { CommunityRow } from "../ranking/rank.ts";

/** Community scores for the sample cards: Runechant creation (1) and Gate creation (2). */
export function sampleCommunity(): CommunityRow[] {
  const rows: CommunityRow[] = [];
  const add = (
    cardId: string,
    variantId: string,
    rc: number,
    gc: number,
    ratingCount = 3,
  ) => {
    for (const side of ["forsaken", "usurper"] as const) {
      rows.push({
        cardId,
        variantId,
        side,
        dimensionId: 1,
        score: rc,
        ratingCount,
      });
      rows.push({
        cardId,
        variantId,
        side,
        dimensionId: 2,
        score: gc,
        ratingCount,
      });
    }
  };
  add("card-hocus-pocus", "hp1", 90, 10);
  add("card-hocus-pocus", "hp2", 70, 10);
  add("card-hocus-pocus", "hp3", 50, 10);
  add("card-become-the-shadow-lord", "bsl3", 60, 80);
  add("card-nebula-blade", "nb", 40, 0);
  // Fate Foreseen: nobody has rated it.
  return rows;
}

import type {
  AreaEngagement,
  DailyEngagement,
  EngagementRepository,
  SiteTotals,
} from "../analytics/engagementRepository.ts";

/** An in-memory EngagementRepository. */
export function fakeEngagementRepository(
  areas: AreaEngagement[] = [],
  daily: DailyEngagement[] = [],
  totals: SiteTotals = { users: 0, usersLast7d: 0, decks: 0, publicDecks: 0 },
): EngagementRepository {
  return {
    listAreas: async () => areas,
    listDaily: async () => daily,
    getTotals: async () => totals,
  };
}

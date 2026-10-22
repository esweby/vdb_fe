import type {
  AreaEngagement,
  DailyEngagement,
  EngagementRepository,
} from "../analytics/engagementRepository.ts";

/** An in-memory EngagementRepository. */
export function fakeEngagementRepository(
  areas: AreaEngagement[] = [],
  daily: DailyEngagement[] = [],
): EngagementRepository {
  return { listAreas: async () => areas, listDaily: async () => daily };
}

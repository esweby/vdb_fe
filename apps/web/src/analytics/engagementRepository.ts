// Review engagement for admins (maintainer, 22 Oct 2026), read through security definer
// functions that return counts only. Behind an interface so tests can use a fake.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AreaEngagement {
  area: string;
  people: number;
  items: number;
  itemsPerPerson: number | null;
  peopleLast7d: number;
  itemsLast7d: number;
  first: string | null;
  latest: string | null;
}

export interface DailyEngagement {
  day: string;
  area: string;
  people: number;
  items: number;
}

export interface EngagementRepository {
  listAreas(): Promise<AreaEngagement[]>;
  listDaily(days: number): Promise<DailyEngagement[]>;
}

interface AreaRow {
  area: string;
  people: number;
  items: number;
  items_per_person: number | null;
  people_last_7d: number;
  items_last_7d: number;
  first: string | null;
  latest: string | null;
}

export function supabaseEngagementRepository(
  client: SupabaseClient,
): EngagementRepository {
  return {
    async listAreas() {
      const { data, error } = await client.rpc("admin_review_engagement");
      if (error) throw error;
      return ((data ?? []) as AreaRow[]).map((r) => ({
        area: r.area,
        people: Number(r.people),
        items: Number(r.items),
        itemsPerPerson:
          r.items_per_person === null ? null : Number(r.items_per_person),
        peopleLast7d: Number(r.people_last_7d),
        itemsLast7d: Number(r.items_last_7d),
        first: r.first,
        latest: r.latest,
      }));
    },
    async listDaily(days) {
      const { data, error } = await client.rpc(
        "admin_review_engagement_daily",
        {
          days,
        },
      );
      if (error) throw error;
      return ((data ?? []) as DailyEngagement[]).map((r) => ({
        day: r.day,
        area: r.area,
        people: Number(r.people),
        items: Number(r.items),
      }));
    },
  };
}

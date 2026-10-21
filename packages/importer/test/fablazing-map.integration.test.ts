// Needs a running local Supabase database (supabase start / supabase db start).
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertCardMap } from "../src/db.ts";

const sql = postgres(
  process.env.DB_URL ??
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  { onnotice: () => {} },
);
// Prefixed ids and slugs, so setup and cleanup never touch real imported rows.
const cleanup = async () => {
  await sql`delete from public.fablazing_card_map where slug like 'test_fb_%'`;
  await sql`delete from public.cards where external_id = 'test:fb-card'`;
  await sql`delete from public.heroes where external_id = 'test:fb-hero'`;
};

beforeAll(async () => {
  await cleanup();
  const [card] = await sql<{ id: string }[]>`
    insert into public.cards (external_id, name, type) values ('test:fb-card', 'Test FaBlazing Card', 'action')
    returning id`;
  await sql`insert into public.variants (card_id, external_id, pitch)
            values (${card!.id}, 'test:fb-card-r', 1), (${card!.id}, 'test:fb-card-b', 3)`;
  await sql`insert into public.heroes (external_id, name) values ('test:fb-hero', 'Test FaBlazing Hero')`;
});

afterAll(async () => {
  await cleanup();
  await sql.end();
});

const mapped = () => sql`
  select m.slug, v.external_id as variant, h.external_id as hero
    from public.fablazing_card_map m
    left join public.variants v on v.id = m.variant_id
    left join public.heroes h on h.id = m.hero_id
   where m.slug like 'test_fb_%' order by m.slug`;

describe("upsertCardMap", () => {
  it("maps slugs to our variants and heroes", async () => {
    await upsertCardMap(sql, [
      { slug: "test_fb_card_red", variantExternalId: "test:fb-card-r" },
      { slug: "test_fb_card_blue", variantExternalId: "test:fb-card-b" },
      { slug: "test_fb_hero", heroExternalId: "test:fb-hero" },
    ]);
    expect(await mapped()).toEqual([
      { slug: "test_fb_card_blue", variant: "test:fb-card-b", hero: null },
      { slug: "test_fb_card_red", variant: "test:fb-card-r", hero: null },
      { slug: "test_fb_hero", variant: null, hero: "test:fb-hero" },
    ]);
  });

  it("is safe to re-run, and moves a slug to its new target", async () => {
    await upsertCardMap(sql, [
      { slug: "test_fb_card_red", variantExternalId: "test:fb-card-b" },
      { slug: "test_fb_hero", heroExternalId: "test:fb-hero" },
    ]);
    const rows = await mapped();
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.slug === "test_fb_card_red")?.variant).toBe(
      "test:fb-card-b",
    );
  });
});

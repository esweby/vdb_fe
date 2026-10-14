// Needs a running local Supabase database (supabase start / supabase db start).
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatasetCard } from "../src/classify.ts";
import { upsertCards } from "../src/db.ts";
import { toImportCards } from "../src/map.ts";
import fixture from "./fixtures/cards.json" with { type: "json" };

const sql = postgres(process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres", {
  onnotice: () => {},
});
// Prefixed ids, so setup and cleanup never touch real imported cards in a local database.
const cards = toImportCards(fixture as DatasetCard[], {}).map((c) => ({
  ...c,
  externalId: `test:${c.externalId}`,
  variants: c.variants.map((v) => ({ ...v, externalId: `test:${v.externalId}` })),
}));
const externalIds = cards.map((c) => c.externalId);

const counts = async () => {
  const [row] = await sql`
    select (select count(*)::int from public.cards where external_id in ${sql(externalIds)}) as cards,
           (select count(*)::int from public.variants v join public.cards c on c.id = v.card_id
             where c.external_id in ${sql(externalIds)}) as variants`;
  return row;
};

beforeAll(async () => {
  await sql`delete from public.cards where external_id in ${sql(externalIds)}`;
});

afterAll(async () => {
  await sql`delete from public.cards where external_id in ${sql(externalIds)}`;
  await sql.end();
});

describe("upsertCards", () => {
  it("inserts every card and variant", async () => {
    await upsertCards(sql, cards);
    expect(await counts()).toEqual({ cards: cards.length, variants: cards.flatMap((c) => c.variants).length });
  });

  it("is safe to re-run: no duplicates", async () => {
    await upsertCards(sql, cards);
    expect(await counts()).toEqual({ cards: cards.length, variants: cards.flatMap((c) => c.variants).length });
  });

  it("keeps curator decisions (fringe, hidden) on re-import", async () => {
    await sql`update public.cards set fringe = true, hidden = true where external_id = 'test:Fate Foreseen'`;
    await upsertCards(sql, cards);
    const [row] = await sql`select fringe, hidden from public.cards where external_id = 'test:Fate Foreseen'`;
    expect(row).toEqual({ fringe: true, hidden: true });
  });

  it("updates imported facts and attributes on re-import", async () => {
    await sql`update public.cards set name = 'Stale', attributes = '{}' where external_id = 'test:Become the Shadow Lord'`;
    await upsertCards(sql, cards);
    const [row] = await sql`
      select name, attributes from public.cards where external_id = 'test:Become the Shadow Lord'`;
    expect(row?.name).toBe("Become the Shadow Lord");
    expect(row?.attributes).toMatchObject({ hasGoAgain: true });
  });

  it("stores variant text and attributes", async () => {
    const rows = await sql`
      select v.pitch, v.text, v.attributes from public.variants v
        join public.cards c on c.id = v.card_id
       where c.external_id = 'test:Arcane Cussing' order by v.pitch`;
    expect(rows.map((r) => r.pitch)).toEqual([1, 2, 3]);
    expect(rows.every((r) => typeof r.text === "string" && r.text.length > 0)).toBe(true);
    expect(rows[0]?.attributes).toEqual({});
  });
});

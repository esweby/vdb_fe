// Fills the local database with mock scorers, scores and reviews, then recalculates community
// scores, so the ranking has rows to show. Local stack only; safe to re-run (it replaces the
// previous mock data and leaves everyone else's scores alone).
// Usage: npm run mock-scores -w @vdb/importer [-- --seed 2]
import { buildScoringInput, computeCommunityScores } from "@vdb/scoring";
import postgres from "postgres";
import { assertLocalDb, mockScores, type MockCard } from "./mock.ts";

const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SCORERS = 5;
const EMAIL = (n: number) => `mock-scorer-${n}@vdb.test`;

async function main() {
  const dbUrl = process.env.DB_URL ?? LOCAL_DB;
  assertLocalDb(dbUrl);
  const seedArg = process.argv.indexOf("--seed");
  const seed = seedArg > 0 ? Number(process.argv[seedArg + 1]) : 1;

  const sql = postgres(dbUrl, { onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      // Deleting the users cascades to their profiles, scores and reviews.
      await tx`delete from auth.users where email like 'mock-scorer-%@vdb.test'`;
      const ids: string[] = [];
      for (let n = 1; n <= SCORERS; n++) {
        const [user] = await tx<{ id: string }[]>`
          insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, recovery_token, email_change, email_change_token_new)
          values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
            'authenticated', ${EMAIL(n)}, '', now(), '{"provider":"email","providers":["email"]}',
            '{}', now(), now(), '', '', '', '')
          returning id`;
        ids.push(user!.id);
      }
      await tx`update public.profiles set role = 'scorer' where id = any(${ids}::uuid[])`;

      const cards = await tx<MockCard[]>`
        select c.id, c.type, c.classes, c.talents, c.attributes,
               coalesce(json_agg(json_build_object('id', v.id, 'pitch', v.pitch,
                 'attributes', v.attributes)) filter (where v.id is not null), '[]') as variants
          from public.cards c left join public.variants v on v.card_id = c.id
         where not c.hidden
         group by c.id
         order by c.id`;
      const dimensions = await tx<{ id: number; key: string }[]>`
        select id, key from public.score_dimensions`;
      const dimensionId = new Map(dimensions.map((d) => [d.key, d.id]));

      const { reviews, scores } = mockScores(cards, ids, seed);
      if (scores.length > 0) {
        await tx`insert into public.card_scores ${tx(
          scores.map((s) => ({
            user_id: s.userId,
            card_id: s.cardId,
            variant_id: s.variantId,
            side: s.side,
            dimension_id: dimensionId.get(s.dimension)!,
            score: s.score,
          })),
        )}`;
        await tx`insert into public.card_reviews ${tx(
          reviews.map((r) => ({ user_id: r.userId, card_id: r.cardId })),
        )}`;
      }

      // The same calculation as the community-scores Edge Function.
      const input = buildScoringInput({
        profiles: await tx`select id, role from public.profiles`,
        raterWeights:
          await tx`select user_id, rating_weight from public.rater_weights`,
        cardReviews: await tx`select user_id, card_id from public.card_reviews`,
        cardScores: await tx`
          select user_id, card_id, variant_id, side, dimension_id, score from public.card_scores`,
        cards: await tx`select id, fringe from public.cards`,
        variants: await tx`select id, card_id from public.variants`,
        scoreDimensions: dimensions,
        appSettings: await tx`select key, value from public.app_settings`,
      } as never);
      const rows = computeCommunityScores(input);
      await tx`select public.replace_community_scores(${tx.json(rows as never)}, ${Date.now()})`;

      const covered = new Set(reviews.map((r) => r.cardId)).size;
      console.log(
        `${SCORERS} mock scorers reviewed ${covered} of ${cards.length} cards ` +
          `(${scores.length} scores); ${rows.length} community score rows.`,
      );
    });
  } finally {
    await sql.end();
  }
}

await main();

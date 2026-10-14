// Community score job: recalculates community_scores from every scorer's reviewed scores.
// Runs on the server because it needs the hidden rating weights (README "Backend").
// The logic lives in @vdb/scoring; this function only fetches, computes and saves.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { buildScoringInput, computeCommunityScores } from "@vdb/scoring";

const PAGE = 1000;

Deno.serve(async () => {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // PostgREST returns at most 1,000 rows per request, so page through every table.
  const all = async (table: string, columns: string) => {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from(table)
        .select(columns)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE) return rows;
    }
  };

  const input = buildScoringInput({
    profiles: (await all("profiles", "id, role")) as never,
    raterWeights: (await all(
      "rater_weights",
      "user_id, rating_weight",
    )) as never,
    cardReviews: (await all("card_reviews", "user_id, card_id")) as never,
    cardScores: (await all(
      "card_scores",
      "user_id, card_id, variant_id, side, dimension_id, score",
    )) as never,
    cards: (await all("cards", "id, fringe")) as never,
    variants: (await all("variants", "id, card_id")) as never,
    scoreDimensions: (await all("score_dimensions", "id")) as never,
    appSettings: (await all("app_settings", "key, value")) as never,
  });

  const rows = computeCommunityScores(input);
  const version = Date.now();
  const { error } = await db.rpc("replace_community_scores", { rows, version });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ rows: rows.length, version });
});

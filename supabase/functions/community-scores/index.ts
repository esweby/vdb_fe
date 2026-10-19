// Community score job: recalculates community_scores from every scorer's reviewed scores.
// Runs on the server because it needs the hidden rating weights (README "Backend").
// The logic lives in @vdb/scoring; this function only fetches, computes and saves.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import {
  buildScoringInput,
  buildSynergyInput,
  computeCommunityScores,
  computeCommunitySynergies,
} from "@vdb/scoring";
import { authorizeJobCaller } from "./auth.ts";

const PAGE = 1000;

Deno.serve(async (request) => {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = await authorizeJobCaller({
    authorization: request.headers.get("Authorization"),
    jobToken: request.headers.get("x-job-token"),
    serverKeys: [
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      Deno.env.get("SUPABASE_SECRET_KEY"),
    ],
    getUserRole: async (token) => {
      const { data } = await db.auth.getUser(token);
      if (!data.user) return null;
      const { data: profile } = await db
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      return (profile?.role as string | undefined) ?? null;
    },
    consumeJobToken: async (token) => {
      const { data, error } = await db.rpc("consume_job_nonce", { token });
      return !error && data === true;
    },
  });
  if (!auth.ok) {
    return Response.json({ error: "Not allowed" }, { status: auth.status });
  }

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

  const profiles = (await all("profiles", "id, role")) as never;
  const raterWeights = (await all(
    "rater_weights",
    "user_id, rating_weight",
  )) as never;
  const input = buildScoringInput({
    profiles,
    raterWeights,
    cardReviews: (await all("card_reviews", "user_id, card_id")) as never,
    cardScores: (await all(
      "card_scores",
      "user_id, card_id, variant_id, side, dimension_id, score",
    )) as never,
    cards: (await all("cards", "id, fringe")) as never,
    variants: (await all("variants", "id, card_id")) as never,
    scoreDimensions: (await all("score_dimensions", "id, key")) as never,
    appSettings: (await all("app_settings", "key, value")) as never,
  });

  const rows = computeCommunityScores(input);
  const version = Date.now();
  const { error } = await db.rpc("replace_community_scores", { rows, version });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // The scoring group's synergy edges and feedback on derived edges (docs/synergy-rules.md).
  const synergies = computeCommunitySynergies(
    buildSynergyInput({
      profiles,
      raterWeights,
      cardSynergies: (await all(
        "card_synergies",
        "user_id, from_card_id, to_card_id, weight",
      )) as never,
      synergyFeedback: (await all(
        "synergy_feedback",
        "user_id, rule_id, from_card_id, to_card_id, verdict, weight",
      )) as never,
    }),
  );
  const { error: synergyError } = await db.rpc("replace_community_synergies", {
    edges: synergies.edges,
    feedback: synergies.feedback,
    version,
  });
  if (synergyError)
    return Response.json({ error: synergyError.message }, { status: 500 });

  return Response.json({
    rows: rows.length,
    synergies: synergies.edges.length,
    synergyFeedback: synergies.feedback.length,
    version,
  });
});

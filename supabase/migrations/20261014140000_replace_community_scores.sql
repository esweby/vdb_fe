-- The community score job's only write path: swap in a full set of community scores
-- atomically. Server only (service role); users can't call it.

create function public.replace_community_scores(rows jsonb, version bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.community_scores where true;
  insert into public.community_scores
    (card_id, variant_id, side, dimension_id, score, rating_count, total_weight, scores_version)
  select r."cardId", r."variantId", r.side::public.side, r."dimensionId",
         r.score, r."ratingCount", r."totalWeight", version
    from jsonb_to_recordset(rows) as r(
      "cardId" uuid, "variantId" uuid, side text, "dimensionId" smallint,
      score numeric, "ratingCount" integer, "totalWeight" numeric
    );
end;
$$;

revoke execute on function public.replace_community_scores(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.replace_community_scores(jsonb, bigint) to service_role;

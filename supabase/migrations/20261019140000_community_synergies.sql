-- Community synergy results (docs/synergy-rules.md "Community feedback"), computed by the
-- community-scores job with @vdb/scoring computeCommunitySynergies. Each row needs at least
-- 2 people, so no single person's opinion shows.

-- The scoring group's own edges: "from helps to".
create table public.community_synergies (
  from_card_id uuid not null references public.cards (id) on delete cascade,
  to_card_id uuid not null references public.cards (id) on delete cascade,
  weight numeric not null check (weight between 0 and 1),
  rating_count integer not null check (rating_count >= 2),
  total_weight numeric not null,
  synergies_version bigint not null,
  computed_at timestamptz not null default now(),
  primary key (from_card_id, to_card_id)
);

-- Their feedback on a derived edge. A confirm vote means "the rule's weight", which admins can
-- change, so the edge's weight is worked out in the browser:
-- confirm_share × the rule's current weight + fixed_part.
create table public.community_synergy_feedback (
  rule_id text not null check (rule_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(rule_id) <= 64),
  from_card_id uuid not null references public.cards (id) on delete cascade,
  to_card_id uuid not null references public.cards (id) on delete cascade,
  confirm_share numeric not null check (confirm_share between 0 and 1),
  fixed_part numeric not null check (fixed_part between 0 and 1),
  rating_count integer not null check (rating_count >= 2),
  total_weight numeric not null,
  synergies_version bigint not null,
  computed_at timestamptz not null default now(),
  primary key (rule_id, from_card_id, to_card_id)
);

alter table public.community_synergies enable row level security;
alter table public.community_synergy_feedback enable row level security;

create policy "Community synergies are public" on public.community_synergies for select
  to anon, authenticated using (true);
create policy "Community synergy feedback is public" on public.community_synergy_feedback for select
  to anon, authenticated using (true);

grant select on public.community_synergies, public.community_synergy_feedback to anon, authenticated;
grant all on public.community_synergies, public.community_synergy_feedback to service_role;

-- The job's only write path: swap in a full set atomically. Server only (service role).
create function public.replace_community_synergies(edges jsonb, feedback jsonb, version bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.community_synergies where true;
  delete from public.community_synergy_feedback where true;
  insert into public.community_synergies
    (from_card_id, to_card_id, weight, rating_count, total_weight, synergies_version)
  select e."fromCardId", e."toCardId", e.weight, e."ratingCount", e."totalWeight", version
    from jsonb_to_recordset(edges) as e(
      "fromCardId" uuid, "toCardId" uuid, weight numeric, "ratingCount" integer, "totalWeight" numeric
    );
  insert into public.community_synergy_feedback
    (rule_id, from_card_id, to_card_id, confirm_share, fixed_part, rating_count, total_weight, synergies_version)
  select f."ruleId", f."fromCardId", f."toCardId", f."confirmShare", f."fixedPart",
         f."ratingCount", f."totalWeight", version
    from jsonb_to_recordset(feedback) as f(
      "ruleId" text, "fromCardId" uuid, "toCardId" uuid, "confirmShare" numeric,
      "fixedPart" numeric, "ratingCount" integer, "totalWeight" numeric
    );
end;
$$;

revoke execute on function public.replace_community_synergies(jsonb, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.replace_community_synergies(jsonb, jsonb, bigint) to service_role;

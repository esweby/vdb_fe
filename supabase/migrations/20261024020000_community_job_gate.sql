-- Serialise community recalculation and bound user-triggered starts. Server only.
create table public.community_job_gate (
  singleton boolean primary key default true check (singleton),
  token uuid,
  lease_until timestamptz,
  last_started_at timestamptz,
  -- Hosted daily run, 24 Oct 2026: 12,218 ms. Allow roughly five times that duration.
  lease_seconds integer not null default 60 check (lease_seconds between 30 and 600)
);
insert into public.community_job_gate (singleton) values (true);
alter table public.community_job_gate enable row level security;
-- No browser access: only the Edge Function's server client uses this state.
revoke all on public.community_job_gate from anon, authenticated;
grant select, insert, update, delete on public.community_job_gate to service_role;

create function public.acquire_community_job(p_scheduled boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  gate public.community_job_gate;
  checked_at timestamptz;
  remaining integer;
  next_token uuid;
begin
  select * into strict gate from public.community_job_gate where singleton for update;
  checked_at := clock_timestamp();
  remaining := greatest(0, ceil(extract(epoch from gate.last_started_at + interval '30 seconds' - checked_at)))::integer;
  if gate.token is not null and gate.lease_until > checked_at then
    return jsonb_build_object('status', 'deferred', 'reason', 'running', 'retryAfter', greatest(30, remaining));
  end if;
  if not coalesce(p_scheduled, false) and remaining > 0 then
    return jsonb_build_object('status', 'deferred', 'reason', 'cooldown', 'retryAfter', remaining);
  end if;
  next_token := gen_random_uuid();
  update public.community_job_gate
    set token = next_token, last_started_at = checked_at,
        lease_until = checked_at + make_interval(secs => gate.lease_seconds)
    where singleton;
  return jsonb_build_object('status', 'started', 'token', next_token);
end;
$$;
revoke all on function public.acquire_community_job(boolean) from public, anon, authenticated;
grant execute on function public.acquire_community_job(boolean) to service_role;

create function public.release_community_job(p_token uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.community_job_gate set token = null, lease_until = null
    where singleton and token = p_token
$$;
revoke all on function public.release_community_job(uuid) from public, anon, authenticated;
grant execute on function public.release_community_job(uuid) to service_role;

-- Replace the unguarded write signatures, so an old worker cannot bypass the lease.
drop function public.replace_community_scores(jsonb, bigint);
drop function public.replace_community_synergies(jsonb, jsonb, bigint);

create function public.replace_community_scores(rows jsonb, version bigint, p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin

  -- Hold the gate row through this transaction; acquisition locks the same row.
  perform 1 from public.community_job_gate
    where singleton and token = p_token and lease_until > clock_timestamp()
    for update;
  if not found then
    raise exception 'Community job lease is not current' using errcode = '42501';
  end if;
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

revoke execute on function public.replace_community_scores(jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.replace_community_scores(jsonb, bigint, uuid) to service_role;

create function public.replace_community_synergies(edges jsonb, feedback jsonb, version bigint, p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin

  -- Hold the gate row through this transaction; acquisition locks the same row.
  perform 1 from public.community_job_gate
    where singleton and token = p_token and lease_until > clock_timestamp()
    for update;
  if not found then
    raise exception 'Community job lease is not current' using errcode = '42501';
  end if;
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

revoke execute on function public.replace_community_synergies(jsonb, jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.replace_community_synergies(jsonb, jsonb, bigint, uuid) to service_role;

-- One additional fixed fallback, using the same fresh-nonce wrapper as 03:00 UTC.
select cron.schedule(
  'community-scores-fallback',
  '15 3 * * *',
  $$select public.invoke_community_scores_job()$$
);

-- FaBlazing history (docs/fablazing-plan.md, "Next steps" 3). The 30 days before the daily ingest
-- began come from files that hold only the games with Viserai on either side. They're whole for
-- Viserai's cards, turns, traverses and Viserai's own matchups, but not for other heroes' matchups
-- or for the run's games and sides (so not for meta share). A run records which it is.

/** all: every game of the day (the daily ingest). viserai: only the games with Viserai. */
alter table public.fablazing_runs
  add column scope text not null default 'all' check (scope in ('all', 'viserai'));

-- As before, plus payload.run.scope (default all). A Viserai-only day carries only Viserai's
-- matchups, and never replaces a day that had every game; a day with every game replaces either.
create or replace function public.fablazing_replace_day(p_date date, p_format smallint, payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run jsonb := payload -> 'run';
  run_scope text := coalesce(payload -> 'run' ->> 'scope', 'all');
begin
  -- A day is only replaced with its counts, so a run row never claims success without them.
  if run is null or run -> 'decks' is null or exists (
    select from unnest(array['games', 'abandoned', 'sides', 'sides_without_detail', 'viserai_sides',
                             'viserai_sides_without_detail', 'capped_sides']) k
     where run ->> k is null
  ) then
    raise exception 'fablazing_replace_day: payload.run is missing its counts or decks'
      using errcode = 'not_null_violation';
  end if;
  if (run ? 'date' and (run ->> 'date')::date <> p_date)
     or (run ? 'format' and (run ->> 'format')::smallint <> p_format) then
    raise exception 'fablazing_replace_day: payload.run is for another date or format'
      using errcode = 'check_violation';
  end if;

  if run_scope not in ('all', 'viserai') then
    raise exception 'fablazing_replace_day: payload.run.scope is all or viserai'
      using errcode = 'check_violation';
  end if;
  -- A Viserai-only day has every game with Viserai, so only Viserai's own matchups are whole.
  if run_scope = 'viserai' and exists (
    select from jsonb_array_elements(coalesce(payload -> 'matchups', '[]')) m where m ->> 'hero' <> 'viserai'
  ) then
    raise exception 'fablazing_replace_day: a Viserai-only day carries only Viserai''s matchups'
      using errcode = 'check_violation';
  end if;

  -- Two replacements of the same day wait for each other rather than collide.
  perform pg_advisory_xact_lock(hashtextextended('fablazing_replace_day:' || p_date || ':' || p_format, 0));

  -- A day that had every game is never replaced by a Viserai-only one. FB001 lets the loader skip it.
  if run_scope = 'viserai' and exists (
    select from public.fablazing_runs r
     where r.date = p_date and r.format = p_format and r.status = 'succeeded' and r.scope = 'all'
  ) then
    raise exception 'fablazing_replace_day: % format % already has every game', p_date, p_format
      using errcode = 'FB001';
  end if;

  delete from public.fablazing_card_daily where date = p_date and format = p_format;
  delete from public.fablazing_matchup_daily where date = p_date and format = p_format;
  delete from public.fablazing_turn_daily where date = p_date and format = p_format;
  delete from public.fablazing_traverse_daily where date = p_date and format = p_format;

  insert into public.fablazing_card_daily
    (date, format, card, side_at_end, decks, copies, result_decks, played, pitched, blocked, hits, wins)
  select p_date, p_format, card, side_at_end, decks, copies, result_decks, played, pitched, blocked, hits, wins
    from jsonb_to_recordset(coalesce(payload -> 'cards', '[]')) as r(
      card text, side_at_end text, decks integer, copies integer, result_decks integer, played integer,
      pitched integer, blocked integer, hits integer, wins integer);

  insert into public.fablazing_matchup_daily (date, format, hero, opponent, games, wins, abandoned)
  select p_date, p_format, hero, opponent, games, wins, abandoned
    from jsonb_to_recordset(coalesce(payload -> 'matchups', '[]')) as r(
      hero text, opponent text, games integer, wins integer, abandoned integer);

  insert into public.fablazing_turn_daily
    (date, format, turn, sides, damage_dealt, damage_taken, life_sides, life_at_end)
  select p_date, p_format, turn, sides, damage_dealt, damage_taken, life_sides, life_at_end
    from jsonb_to_recordset(coalesce(payload -> 'turns', '[]')) as r(
      turn smallint, sides integer, damage_dealt integer, damage_taken integer, life_sides integer,
      life_at_end integer);

  insert into public.fablazing_traverse_daily
    (date, format, side_at_end, first_traverse_turn, traverses, sides, wins)
  select p_date, p_format, side_at_end, first_traverse_turn, traverses, sides, wins
    from jsonb_to_recordset(coalesce(payload -> 'traverses', '[]')) as r(
      side_at_end text, first_traverse_turn smallint, traverses smallint, sides integer, wins integer);

  insert into public.fablazing_runs
    (date, format, scope, status, games, abandoned, sides, sides_without_detail, viserai_sides,
     viserai_sides_without_detail, capped_sides, decks, unmatched_slugs, error, updated_at)
  select p_date, p_format, run_scope, 'succeeded', r.games, r.abandoned, r.sides, r.sides_without_detail,
         r.viserai_sides, r.viserai_sides_without_detail, r.capped_sides, run -> 'decks',
         array(
           select distinct s.slug
             from jsonb_array_elements_text(coalesce(run -> 'card_ids', '[]') || coalesce(run -> 'hero_ids', '[]')) s(slug)
            where s.slug <> 'viserai'
              and not exists (select from public.fablazing_card_map m where m.slug = s.slug)
            order by s.slug),
         null, now()
    from jsonb_to_record(run) as r(
      games integer, abandoned integer, sides integer, sides_without_detail integer,
      viserai_sides integer, viserai_sides_without_detail integer, capped_sides integer)
  on conflict (date, format) do update set
    scope = excluded.scope,
    status = excluded.status,
    games = excluded.games,
    abandoned = excluded.abandoned,
    sides = excluded.sides,
    sides_without_detail = excluded.sides_without_detail,
    viserai_sides = excluded.viserai_sides,
    viserai_sides_without_detail = excluded.viserai_sides_without_detail,
    capped_sides = excluded.capped_sides,
    decks = excluded.decks,
    unmatched_slugs = excluded.unmatched_slugs,
    error = null,
    updated_at = now();
end;
$$;

-- create or replace keeps the function's grants; restated so this file stands on its own.
revoke all on function public.fablazing_replace_day(date, smallint, jsonb) from public, anon, authenticated;
grant execute on function public.fablazing_replace_day(date, smallint, jsonb) to fablazing_ingest, service_role;

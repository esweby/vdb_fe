-- FaBlazing game data (docs/fablazing-plan.md, step 3). A Go Lambda reads FaBlazing's daily file
-- of public Talishar games and writes aggregates here as the fablazing_ingest role, replacing a
-- whole date and format at a time (fablazing_replace_day). Everyone reads them; nobody in the app
-- writes them. Formats are FaBlazing's codes: 0 Classic Constructed, 1 Competitive CC.

-- The ingest role. Roles belong to the cluster, so only create it once. It has no password here:
-- the maintainer sets one in the hosted project.
do $$
begin
  if not exists (select from pg_roles where rolname = 'fablazing_ingest') then
    create role fablazing_ingest login nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end
$$;
grant usage on schema public to fablazing_ingest;
-- So migrations and pgTAP tests (run as postgres) can act as it. postgres doesn't inherit its rights.
grant fablazing_ingest to postgres with inherit false, set true;

-- One row per date and format: how the ingest went. The counts and decks are the aggregator's
-- run summary (services/fablazing/aggregate).
create table public.fablazing_runs (
  date date not null,
  format smallint not null check (format in (0, 1)),
  status text not null default 'succeeded' check (status in ('running', 'succeeded', 'failed')),
  games integer check (games >= 0),
  /** Games left out of results: early concessions without real damage. */
  abandoned integer check (abandoned >= 0),
  sides integer check (sides >= 0),
  sides_without_detail integer check (sides_without_detail >= 0),
  viserai_sides integer check (viserai_sides >= 0),
  viserai_sides_without_detail integer check (viserai_sides_without_detail >= 0),
  /** Sides left out by the cap on one player's weight. */
  capped_sides integer check (capped_sides >= 0),
  /** Inclusion denominators by the side Viserai ended on: {side: {decks, result_decks, wins}}. */
  decks jsonb check (decks is null or jsonb_typeof(decks) = 'object'),
  /** FaBlazing ids seen in the run that fablazing_card_map doesn't know. */
  unmatched_slugs text[] not null default '{}',
  /** Counts only, never game data or secrets. */
  error text check (char_length(error) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (date, format)
);

-- FaBlazing id (fablazingSlug in packages/importer) → our variant or hero. The importer fills it.
create table public.fablazing_card_map (
  slug text primary key check (char_length(slug) between 1 and 200),
  variant_id uuid references public.variants (id) on delete cascade,
  hero_id uuid references public.heroes (id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint fablazing_card_map_one_target check (num_nonnulls(variant_id, hero_id) = 1)
);

-- Viserai is one hero; card and traverse rows are split by the side it ended the game on.
create domain public.fablazing_viserai_side as text
  check (value in ('viserai_the_forsaken', 'viserai_usurper'));

-- Per card per side per day, over Viserai's sides with detail. decks and copies include abandoned
-- games (kept for decklists); result_decks, the use counts and wins leave them out.
create table public.fablazing_card_daily (
  date date not null,
  format smallint not null check (format in (0, 1)),
  card text not null,
  side_at_end public.fablazing_viserai_side not null,
  decks integer not null check (decks >= 0),
  copies integer not null check (copies >= 0),
  result_decks integer not null check (result_decks between 0 and decks),
  played integer not null check (played >= 0),
  pitched integer not null check (pitched >= 0),
  blocked integer not null check (blocked >= 0),
  hits integer not null check (hits >= 0),
  wins integer not null check (wins between 0 and result_decks),
  primary key (date, format, card, side_at_end)
);

-- Per hero per opposing hero per day, across every game (one row from each side, so meta share
-- can be worked out), with Viserai as "viserai". games counts results only.
create table public.fablazing_matchup_daily (
  date date not null,
  format smallint not null check (format in (0, 1)),
  hero text not null,
  opponent text not null,
  games integer not null check (games >= 0),
  wins integer not null check (wins between 0 and games),
  abandoned integer not null check (abandoned >= 0),
  primary key (date, format, hero, opponent)
);

-- Per turn index (a round: one turn for each player) per day, over Viserai's results: sums, so
-- means and calibration can be worked out later.
create table public.fablazing_turn_daily (
  date date not null,
  format smallint not null check (format in (0, 1)),
  turn smallint not null check (turn >= 0),
  sides integer not null check (sides >= 0),
  damage_dealt integer not null check (damage_dealt >= 0),
  damage_taken integer not null check (damage_taken >= 0),
  life_sides integer not null check (life_sides >= 0),
  /** Sum of Viserai's life at the end of the turn, over life_sides. */
  life_at_end integer not null,
  primary key (date, format, turn)
);

-- Traverse timing per day, over Viserai's results: the side it ended on, the turn index of its
-- first traverse (-1 when it never traversed) and how many times it traversed.
create table public.fablazing_traverse_daily (
  date date not null,
  format smallint not null check (format in (0, 1)),
  side_at_end public.fablazing_viserai_side not null,
  first_traverse_turn smallint not null check (first_traverse_turn >= -1),
  traverses smallint not null check (traverses >= 0),
  sides integer not null check (sides >= 0),
  wins integer not null check (wins between 0 and sides),
  primary key (date, format, side_at_end, first_traverse_turn, traverses)
);

-- The dated ban, restricted and errata list. A window runs from starts_on up to (not including)
-- ends_on; the open window has no end, so only one can be open. Aggregates never span a window boundary.
create table public.fablazing_rules_windows (
  id smallint primary key generated always as identity,
  starts_on date not null,
  ends_on date check (ends_on > starts_on),
  changes text not null check (char_length(changes) between 1 and 2000),
  /** FaBlazing ids of the cards the change touches. */
  affected_slugs text[] not null default '{}',
  constraint fablazing_rules_windows_no_overlap
    exclude using gist (daterange(starts_on, ends_on, '[)') with &&)
);

-- The last ban and restricted update came before Viserai's release (Usurp the Shadow Throne,
-- 25 Sep 2026), so every Viserai game so far is in one window (the maintainer, 21 Oct 2026).
insert into public.fablazing_rules_windows (starts_on, changes) values
  ('2026-09-25', 'Viserai''s release. No ban, restricted or errata changes since.');

-- Replaces one date and format whole, in one transaction: every daily row, and the run row with
-- the slugs fablazing_card_map doesn't know. payload is the aggregator's Result as JSON
-- (services/fablazing/aggregate): {"run": {...}, "cards": [...], "matchups": [...],
-- "turns": [...], "traverses": [...]}; the column names are its JSON names.
-- Runs with the caller's privileges, so only a role that may write the tables can use it.
create function public.fablazing_replace_day(p_date date, p_format smallint, payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run jsonb := payload -> 'run';
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

  -- Two replacements of the same day wait for each other rather than collide.
  perform pg_advisory_xact_lock(hashtextextended('fablazing_replace_day:' || p_date || ':' || p_format, 0));

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
    (date, format, status, games, abandoned, sides, sides_without_detail, viserai_sides,
     viserai_sides_without_detail, capped_sides, decks, unmatched_slugs, error, updated_at)
  select p_date, p_format, 'succeeded', r.games, r.abandoned, r.sides, r.sides_without_detail,
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

-- Row level security: everyone reads; the ingest role writes days and runs.
alter table public.fablazing_runs enable row level security;
alter table public.fablazing_card_map enable row level security;
alter table public.fablazing_card_daily enable row level security;
alter table public.fablazing_matchup_daily enable row level security;
alter table public.fablazing_turn_daily enable row level security;
alter table public.fablazing_traverse_daily enable row level security;
alter table public.fablazing_rules_windows enable row level security;

create policy "Anyone reads FaBlazing runs" on public.fablazing_runs for select
  to anon, authenticated, fablazing_ingest using (true);
create policy "Anyone reads the FaBlazing card map" on public.fablazing_card_map for select
  to anon, authenticated, fablazing_ingest using (true);
create policy "Anyone reads FaBlazing card stats" on public.fablazing_card_daily for select
  to anon, authenticated, fablazing_ingest using (true);
create policy "Anyone reads FaBlazing matchups" on public.fablazing_matchup_daily for select
  to anon, authenticated, fablazing_ingest using (true);
create policy "Anyone reads FaBlazing turns" on public.fablazing_turn_daily for select
  to anon, authenticated, fablazing_ingest using (true);
create policy "Anyone reads FaBlazing traverses" on public.fablazing_traverse_daily for select
  to anon, authenticated, fablazing_ingest using (true);
create policy "Anyone reads the rules windows" on public.fablazing_rules_windows for select
  to anon, authenticated, fablazing_ingest using (true);

create policy "Ingest records runs" on public.fablazing_runs for insert
  to fablazing_ingest with check (true);
create policy "Ingest updates runs" on public.fablazing_runs for update
  to fablazing_ingest using (true) with check (true);
create policy "Ingest writes card stats" on public.fablazing_card_daily for insert
  to fablazing_ingest with check (true);
create policy "Ingest clears card stats" on public.fablazing_card_daily for delete
  to fablazing_ingest using (true);
create policy "Ingest writes matchups" on public.fablazing_matchup_daily for insert
  to fablazing_ingest with check (true);
create policy "Ingest clears matchups" on public.fablazing_matchup_daily for delete
  to fablazing_ingest using (true);
create policy "Ingest writes turns" on public.fablazing_turn_daily for insert
  to fablazing_ingest with check (true);
create policy "Ingest clears turns" on public.fablazing_turn_daily for delete
  to fablazing_ingest using (true);
create policy "Ingest writes traverses" on public.fablazing_traverse_daily for insert
  to fablazing_ingest with check (true);
create policy "Ingest clears traverses" on public.fablazing_traverse_daily for delete
  to fablazing_ingest using (true);

-- Grants. App roles only read. The ingest role writes days and runs, and only reads the card map
-- (the importer fills it, as the server) and the rules windows (changed in migrations).
grant select on
  public.fablazing_runs, public.fablazing_card_map, public.fablazing_card_daily,
  public.fablazing_matchup_daily, public.fablazing_turn_daily, public.fablazing_traverse_daily,
  public.fablazing_rules_windows
  to anon, authenticated, fablazing_ingest;
grant insert, delete on
  public.fablazing_card_daily, public.fablazing_matchup_daily, public.fablazing_turn_daily,
  public.fablazing_traverse_daily
  to fablazing_ingest;
grant insert, update on public.fablazing_runs to fablazing_ingest;
grant all on
  public.fablazing_runs, public.fablazing_card_map, public.fablazing_card_daily,
  public.fablazing_matchup_daily, public.fablazing_turn_daily, public.fablazing_traverse_daily,
  public.fablazing_rules_windows
  to service_role;

revoke all on function public.fablazing_replace_day(date, smallint, jsonb) from public, anon, authenticated;
grant execute on function public.fablazing_replace_day(date, smallint, jsonb) to fablazing_ingest, service_role;

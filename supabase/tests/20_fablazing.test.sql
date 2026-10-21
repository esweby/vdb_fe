-- FaBlazing game data (docs/fablazing-plan.md, step 3): the Go Lambda writes daily aggregates as
-- the fablazing_ingest role, replacing a whole date and format at a time; everyone reads them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

select has_table('public', t, t || ' exists')
  from unnest(array['fablazing_runs', 'fablazing_card_map', 'fablazing_card_daily',
                    'fablazing_matchup_daily', 'fablazing_turn_daily', 'fablazing_traverse_daily',
                    'fablazing_rules_windows']) t;

-- Rules windows: one open window from Viserai's release (no ban or restricted changes since,
-- the maintainer, 21 Oct 2026).
select results_eq(
  $$select starts_on, ends_on from public.fablazing_rules_windows$$,
  $$values ('2026-09-25'::date, null::date)$$,
  'one open rules window, from Viserai''s release'
);
select throws_ok(
  $$insert into public.fablazing_rules_windows (starts_on, changes) values ('2026-12-01', 'second open window')$$,
  '23P01', null, 'only one window is open at a time'
);
select throws_ok(
  $$insert into public.fablazing_rules_windows (starts_on, ends_on, changes) values ('2026-10-01', '2026-10-10', 'overlaps')$$,
  '23P01', null, 'windows never overlap'
);

-- Card map: a slug is our variant or our hero, never both or neither, unless it's ignored.
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-000000000fb1', 'ext-fb-1', 'FaBlazing Card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('11000000-0000-0000-0000-000000000fb1', '10000000-0000-0000-0000-000000000fb1', 'ext-fb-1-r', 1);
insert into public.heroes (id, external_id, name) values
  ('40000000-0000-0000-0000-000000000fb1', 'ext-fb-hero', 'FaBlazing Hero');
select lives_ok(
  $$insert into public.fablazing_card_map (slug, variant_id) values ('fablazing_card_red', '11000000-0000-0000-0000-000000000fb1');
    insert into public.fablazing_card_map (slug, hero_id) values ('fablazing_hero', '40000000-0000-0000-0000-000000000fb1')$$,
  'a slug maps to a variant or a hero'
);
select throws_ok(
  $$insert into public.fablazing_card_map (slug) values ('nothing')$$,
  '23514', null, 'a slug maps to something'
);
select throws_ok(
  $$insert into public.fablazing_card_map (slug, variant_id, hero_id)
    values ('both', '11000000-0000-0000-0000-000000000fb1', '40000000-0000-0000-0000-000000000fb1')$$,
  '23514', null, 'a slug maps to one thing'
);
select lives_ok(
  $$insert into public.fablazing_card_map (slug, ignored) values ('UNKNOWNHERO', true)$$,
  'an ignored id maps to nothing'
);
select throws_ok(
  $$insert into public.fablazing_card_map (slug, hero_id, ignored) values ('ignored_hero', '40000000-0000-0000-0000-000000000fb1', true)$$,
  '23514', null, 'an ignored id maps to nothing else'
);

-- The ingest role: logs in, has no special powers, and can't be used by the app's roles.
select ok(
  (select rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb
     from pg_roles where rolname = 'fablazing_ingest'),
  'fablazing_ingest logs in with no special powers'
);
select is(
  (select array_agg(c.relnamespace::regnamespace || '.' || c.relname)
     from pg_class c
    where c.relkind in ('r', 'v', 'm', 'p')
      and c.relnamespace::regnamespace::text in ('public', 'auth', 'storage', 'supabase_migrations', 'vault')
      and c.relname not like 'fablazing\_%'
      and has_table_privilege('fablazing_ingest', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')),
  null,
  'fablazing_ingest can''t read or write any table but the fablazing ones'
);
select ok(
  has_function_privilege('fablazing_ingest', 'public.fablazing_replace_day(date, smallint, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.fablazing_replace_day(date, smallint, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.fablazing_replace_day(date, smallint, jsonb)', 'execute'),
  'only fablazing_ingest (and the server) replaces a day'
);

-- Replacing a day, as the ingest role. pgTAP lives in the extensions schema, which the role
-- doesn't otherwise use (rolled back with the test).
grant usage on schema extensions to fablazing_ingest;
set local role fablazing_ingest;
select lives_ok(
  format($$select public.fablazing_replace_day('2026-10-20', 0::smallint, %L::jsonb)$$, '{
    "run": {"date": "2026-10-20", "format": 0, "games": 4950, "abandoned": 120, "sides": 9900,
            "sides_without_detail": 900, "viserai_sides": 500, "viserai_sides_without_detail": 45, "capped_sides": 12,
            "decks": {"viserai_usurper": {"decks": 300, "result_decks": 290, "wins": 150}},
            "card_ids": ["fablazing_card_red", "mystery_card_red"], "hero_ids": ["fablazing_hero", "viserai", "fang_dragonbound", "UNKNOWNHERO"]},
    "cards": [
      {"card": "fablazing_card_red", "side_at_end": "viserai_usurper", "decks": 40, "copies": 120, "result_decks": 38,
       "played": 90, "pitched": 10, "blocked": 5, "hits": 30, "wins": 20},
      {"card": "fablazing_card_red", "side_at_end": "viserai_the_forsaken", "decks": 10, "copies": 30, "result_decks": 10,
       "played": 5, "pitched": 25, "blocked": 0, "hits": 1, "wins": 4}],
    "matchups": [
      {"hero": "viserai", "opponent": "fang_dragonbound", "games": 72, "wins": 40, "abandoned": 6},
      {"hero": "fang_dragonbound", "opponent": "viserai", "games": 72, "wins": 32, "abandoned": 6}],
    "turns": [
      {"turn": 0, "sides": 70, "damage_dealt": 200, "damage_taken": 150, "life_sides": 70, "life_at_end": 2700},
      {"turn": 1, "sides": 68, "damage_dealt": 420, "damage_taken": 380, "life_sides": 66, "life_at_end": 2300}],
    "traverses": [
      {"side_at_end": "viserai_usurper", "first_traverse_turn": 2, "traverses": 1, "sides": 50, "wins": 30},
      {"side_at_end": "viserai_the_forsaken", "first_traverse_turn": -1, "traverses": 0, "sides": 20, "wins": 5}]
  }'),
  'the ingest role replaces a day with the aggregator''s rows'
);
select lives_ok(
  $$select public.fablazing_replace_day('2026-10-20', 1::smallint, '{
    "run": {"games": 3200, "abandoned": 80, "sides": 6400, "sides_without_detail": 600, "viserai_sides": 428,
            "viserai_sides_without_detail": 40, "capped_sides": 0, "decks": {}},
    "cards": [{"card": "fablazing_card_red", "side_at_end": "viserai_usurper", "decks": 30, "copies": 90,
               "result_decks": 29, "played": 70, "pitched": 5, "blocked": 3, "hits": 20, "wins": 15}]
  }'::jsonb)$$,
  'the other format is its own day'
);
select is((select count(*)::int from public.fablazing_card_daily where date = '2026-10-20' and format = 0), 2, 'cards stored by side');
select is((select count(*)::int from public.fablazing_matchup_daily where date = '2026-10-20' and format = 0), 2, 'matchups stored from both sides');
select is((select count(*)::int from public.fablazing_turn_daily where date = '2026-10-20' and format = 0), 2, 'turns stored');
select is((select count(*)::int from public.fablazing_traverse_daily where date = '2026-10-20' and format = 0), 2, 'traverses stored');
select results_eq(
  $$select status, games, decks -> 'viserai_usurper' ->> 'decks', unmatched_slugs
      from public.fablazing_runs where date = '2026-10-20' and format = 0$$,
  $$values ('succeeded'::text, 4950, '300'::text, array['fang_dragonbound', 'mystery_card_red'])$$,
  'the run is recorded with its counts, and the slugs the card map doesn''t know or ignore'
);

-- Running the same day again replaces it whole.
select lives_ok(
  $$select public.fablazing_replace_day('2026-10-20', 0::smallint, '{
    "run": {"games": 4960, "abandoned": 121, "sides": 9920, "sides_without_detail": 900, "viserai_sides": 501,
            "viserai_sides_without_detail": 45, "capped_sides": 12, "decks": {}},
    "cards": [{"card": "fablazing_card_red", "side_at_end": "viserai_usurper", "decks": 41, "copies": 123,
               "result_decks": 39, "played": 91, "pitched": 10, "blocked": 5, "hits": 30, "wins": 21}],
    "matchups": [{"hero": "viserai", "opponent": "fang_dragonbound", "games": 73, "wins": 41, "abandoned": 6}]
  }'::jsonb)$$,
  'a day can be replaced'
);
select results_eq(
  $$select card, side_at_end::text, decks from public.fablazing_card_daily where date = '2026-10-20' and format = 0$$,
  $$values ('fablazing_card_red'::text, 'viserai_usurper'::text, 41)$$,
  'replacing a day drops its old rows'
);
select is((select count(*)::int from public.fablazing_turn_daily where date = '2026-10-20' and format = 0), 0, 'old turns are gone');
select is((select games from public.fablazing_runs where date = '2026-10-20' and format = 0), 4960, 'the run is updated');
select is((select count(*)::int from public.fablazing_card_daily where date = '2026-10-20' and format = 1), 1, 'the other format is untouched');

-- A bad payload changes nothing.
select throws_ok(
  $$select public.fablazing_replace_day('2026-10-20', 0::smallint, '{
    "run": {"games": 1, "abandoned": 0, "sides": 2, "sides_without_detail": 0, "viserai_sides": 1,
            "viserai_sides_without_detail": 0, "capped_sides": 0, "decks": {}},
    "cards": [{"card": "fablazing_card_red", "side_at_end": "viserai_usurper", "decks": -1, "copies": 0,
               "result_decks": 0, "played": 0, "pitched": 0, "blocked": 0, "hits": 0, "wins": 0}]
  }'::jsonb)$$,
  '23514', null, 'negative counts are refused'
);
select is((select decks from public.fablazing_card_daily where date = '2026-10-20' and format = 0), 41, 'a refused day keeps the old rows');
select throws_ok(
  $$select public.fablazing_replace_day('2026-10-20', 0::smallint, '{"cards": []}'::jsonb)$$,
  '23502', null, 'a day without its run counts is refused'
);
select is((select decks from public.fablazing_card_daily where date = '2026-10-20' and format = 0), 41, 'so is a day without counts');
select throws_ok(
  $$select public.fablazing_replace_day('2026-10-20', 0::smallint, '{
    "run": {"games": 1, "abandoned": 0, "sides": 2, "sides_without_detail": 0, "viserai_sides": 1,
            "viserai_sides_without_detail": 0, "capped_sides": 0, "decks": {}},
    "cards": [{"card": "fablazing_card_red", "side_at_end": "viserai_usurper", "decks": 1, "copies": 3,
               "result_decks": 1, "played": 0, "pitched": 0, "blocked": 0, "hits": 0, "wins": 2}]
  }'::jsonb)$$,
  '23514', null, 'wins never exceed results'
);
select throws_ok(
  $$select public.fablazing_replace_day('2026-10-20', 0::smallint, '{
    "run": {"games": 1, "abandoned": 0, "sides": 2, "sides_without_detail": 0, "viserai_sides": 1,
            "viserai_sides_without_detail": 0, "capped_sides": 0, "decks": {}},
    "traverses": [{"side_at_end": "viserai", "first_traverse_turn": -1, "traverses": 0, "sides": 1, "wins": 0}]
  }'::jsonb)$$,
  '23514', null, 'Viserai''s side is one of its two hero cards'
);
select throws_ok(
  $$select public.fablazing_replace_day('2026-10-21', 0::smallint, '{
    "run": {"date": "2026-10-20", "format": 0, "games": 1, "abandoned": 0, "sides": 2, "sides_without_detail": 0,
            "viserai_sides": 1, "viserai_sides_without_detail": 0, "capped_sides": 0, "decks": {}}}'::jsonb)$$,
  '23514', null, 'a run for another date is refused'
);
select throws_ok(
  $$select public.fablazing_replace_day('2026-10-21', 2::smallint, '{
    "run": {"games": 1, "abandoned": 0, "sides": 2, "sides_without_detail": 0, "viserai_sides": 1,
            "viserai_sides_without_detail": 0, "capped_sides": 0, "decks": {}}}'::jsonb)$$,
  '23514', null, 'only formats 0 (Classic Constructed) and 1 (Competitive CC)'
);

-- A failed run is recorded directly, without touching the day's rows.
select lives_ok(
  $$insert into public.fablazing_runs (date, format, status, error) values ('2026-10-21', 0, 'failed', 'download: 503')$$,
  'the ingest role records a failed run'
);

-- The ingest role can't touch the card map, the rules windows or anything else.
select throws_ok(
  $$insert into public.fablazing_card_map (slug, hero_id) values ('x', '40000000-0000-0000-0000-000000000fb1')$$,
  '42501', null, 'the ingest role can''t change the card map (the importer fills it)'
);
select throws_ok(
  $$insert into public.fablazing_rules_windows (starts_on, ends_on, changes) values ('2026-01-01', '2026-02-01', 'x')$$,
  '42501', null, 'the ingest role can''t change the rules windows'
);
select throws_ok(
  $$update public.fablazing_card_daily set decks = 0$$,
  '42501', null, 'the ingest role only replaces days, never edits them'
);
select throws_ok($$select count(*) from public.cards$$, '42501', null, 'the ingest role can''t read cards');
reset role;

-- The server adds earlier, closed windows (migrations run as postgres; this checks the grants).
set local role service_role;
select lives_ok(
  $$insert into public.fablazing_rules_windows (starts_on, ends_on, changes) values ('2026-01-01', '2026-09-25', 'Before Viserai')$$,
  'a closed window can end where the next starts'
);
reset role;

-- A variant that goes away takes its mapping with it.
delete from public.variants where id = '11000000-0000-0000-0000-000000000fb1';
select is((select count(*)::int from public.fablazing_card_map where slug = 'fablazing_card_red'), 0, 'mappings follow their variant');

-- Everyone reads the aggregates; nobody in the app writes them.
set local role anon;
select is((select count(*)::int from public.fablazing_card_daily where date = '2026-10-20'), 2, 'anyone reads card stats');
select throws_ok(
  $$select public.fablazing_replace_day('2026-10-22', 0::smallint, '{}'::jsonb)$$,
  '42501', null, 'anon can''t replace a day'
);
reset role;

select * from finish();
rollback;

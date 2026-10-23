-- FaBlazing app views (docs/fablazing-plan.md, step 3; next step 4): a rolling 30-day window over
-- the daily tables, ending on the latest succeeded run and never crossing a rules window boundary.
-- Sums only; the app works out rates and Wilson intervals.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_view('public', v, v || ' exists')
  from unnest(array['fablazing_window', 'fablazing_viserai_baseline', 'fablazing_card_stats',
                    'fablazing_viserai_matchups']) v;
select ok(
  (select bool_and(coalesce('security_invoker=true' = any(c.reloptions), false))
     from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relname in ('fablazing_window', 'fablazing_viserai_baseline', 'fablazing_card_stats',
                        'fablazing_viserai_matchups')),
  'the views run with the reader''s rights'
);

-- Start empty (rolled back with the test).
delete from public.fablazing_card_daily;
delete from public.fablazing_matchup_daily;
delete from public.fablazing_runs;
delete from public.fablazing_card_map;

insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-000000000fc1', 'ext-fc-1', 'View Card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('11000000-0000-0000-0000-000000000fc1', '10000000-0000-0000-0000-000000000fc1', 'ext-fc-1-r', 1),
  ('11000000-0000-0000-0000-000000000fc2', '10000000-0000-0000-0000-000000000fc1', 'ext-fc-1-b', 3);
insert into public.heroes (id, external_id, name) values
  ('40000000-0000-0000-0000-000000000fc1', 'ext-fc-hero', 'View Hero');
insert into public.fablazing_card_map (slug, variant_id) values
  ('view_card_red', '11000000-0000-0000-0000-000000000fc1'),
  ('view_card_blue', '11000000-0000-0000-0000-000000000fc2');
insert into public.fablazing_card_map (slug, hero_id) values
  ('view_hero', '40000000-0000-0000-0000-000000000fc1');

-- Runs: the latest succeeded day is 30 Oct; a later failed day doesn't count. 30 Sep is 31 days
-- back, outside the window. Competitive CC (format 1) has its own window.
insert into public.fablazing_runs (date, format, status, decks) values
  ('2026-09-30', 0, 'succeeded', '{"viserai_usurper": {"decks": 100, "result_decks": 100, "wins": 100}}'),
  ('2026-10-01', 0, 'succeeded', '{"viserai_usurper": {"decks": 60, "result_decks": 55, "wins": 30},
                                   "viserai_the_forsaken": {"decks": 40, "result_decks": 40, "wins": 10}}'),
  ('2026-10-30', 0, 'succeeded', '{"viserai_usurper": {"decks": 50, "result_decks": 50, "wins": 25}}'),
  ('2026-10-31', 0, 'failed', null),
  ('2026-10-15', 1, 'succeeded', '{"viserai_usurper": {"decks": 10, "result_decks": 10, "wins": 6}}');

select results_eq(
  $$select format, starts_on, latest from public.fablazing_window order by format$$,
  $$values (0::smallint, '2026-10-01'::date, '2026-10-30'::date),
           (1::smallint, '2026-09-25'::date, '2026-10-15'::date)$$,
  'the window ends on the latest succeeded run, 30 days long, and never starts before the rules window'
);
select results_eq(
  $$select format, days, decks, result_decks, wins from public.fablazing_viserai_baseline where format = 0$$,
  $$values (0::smallint, 2::bigint, 150::bigint, 145::bigint, 65::bigint)$$,
  'the baseline sums both sides of Viserai over the days in the window'
);

insert into public.fablazing_card_daily
  (date, format, card, side_at_end, decks, copies, result_decks, played, pitched, blocked, hits, wins) values
  ('2026-09-30', 0, 'view_card_red', 'viserai_usurper', 99, 99, 99, 99, 99, 99, 99, 99),
  ('2026-10-01', 0, 'view_card_red', 'viserai_usurper', 30, 90, 28, 60, 10, 5, 20, 15),
  ('2026-10-01', 0, 'view_card_red', 'viserai_the_forsaken', 10, 25, 10, 8, 4, 1, 2, 3),
  ('2026-10-30', 0, 'view_card_red', 'viserai_usurper', 20, 55, 20, 30, 6, 2, 9, 11),
  ('2026-10-30', 0, 'view_card_blue', 'viserai_usurper', 5, 5, 5, 1, 4, 0, 0, 2),
  ('2026-10-30', 0, 'mystery_card_red', 'viserai_usurper', 5, 5, 5, 1, 4, 0, 0, 2);

select results_eq(
  $$select card, variant_id, card_id, decks, copies, result_decks, played, pitched, blocked, hits, wins
      from public.fablazing_card_stats where format = 0 and card = 'view_card_red'$$,
  $$values ('view_card_red', '11000000-0000-0000-0000-000000000fc1'::uuid, '10000000-0000-0000-0000-000000000fc1'::uuid,
            60::bigint, 170::bigint, 58::bigint, 98::bigint, 20::bigint, 8::bigint, 31::bigint, 29::bigint)$$,
  'card stats sum both sides over the window, by our variant and card'
);
select results_eq(
  $$select starts_on, latest, base_decks, base_result_decks, base_wins
      from public.fablazing_card_stats where format = 0 and card = 'view_card_red'$$,
  $$values ('2026-10-01'::date, '2026-10-30'::date, 150::bigint, 145::bigint, 65::bigint)$$,
  'each card row carries its window and Viserai''s baseline'
);
select is(
  (select count(*) from public.fablazing_card_stats where format = 0),
  3::bigint,
  'every card in the window, mapped or not'
);
select is(
  (select variant_id from public.fablazing_card_stats where format = 0 and card = 'mystery_card_red'),
  null,
  'a card the map doesn''t know has no variant'
);
select is(
  (select count(*) from public.fablazing_card_stats where format = 1),
  0::bigint,
  'formats are kept apart'
);

-- Matchups: only Viserai's rows, with every opponent's share of Viserai's games.
insert into public.fablazing_matchup_daily (date, format, hero, opponent, games, wins, abandoned) values
  ('2026-09-30', 0, 'viserai', 'view_hero', 500, 500, 0),
  ('2026-10-01', 0, 'viserai', 'view_hero', 40, 22, 3),
  ('2026-10-30', 0, 'viserai', 'view_hero', 20, 8, 1),
  ('2026-10-30', 0, 'viserai', 'unknown_hero', 40, 20, 0),
  ('2026-10-30', 0, 'view_hero', 'viserai', 20, 12, 1),
  ('2026-10-30', 0, 'view_hero', 'unknown_hero', 70, 35, 0);

select results_eq(
  $$select opponent, hero_id, games, wins, abandoned, total_games
      from public.fablazing_viserai_matchups where format = 0 order by opponent$$,
  $$values ('unknown_hero', null::uuid, 40::bigint, 20::bigint, 0::bigint, 100::bigint),
           ('view_hero', '40000000-0000-0000-0000-000000000fc1'::uuid, 60::bigint, 30::bigint, 4::bigint, 100::bigint)$$,
  'Viserai''s matchups over the window, with the games meta share is worked out from'
);
select results_eq(
  $$select starts_on, latest from public.fablazing_viserai_matchups where format = 0 limit 1$$,
  $$values ('2026-10-01'::date, '2026-10-30'::date)$$,
  'each matchup row carries its window'
);

-- FaBlazing records the hero a side ended as: a transformed hero's id maps to the hero row it came
-- from and counts as that opponent. Ignored ids aren't shown but still count toward total_games.
insert into public.fablazing_card_map (slug, hero_id) values
  ('view_hero_transformed', '40000000-0000-0000-0000-000000000fc1');
insert into public.fablazing_card_map (slug, ignored) values ('view_ignored', true);
insert into public.fablazing_matchup_daily (date, format, hero, opponent, games, wins, abandoned) values
  ('2026-10-30', 0, 'viserai', 'view_hero_transformed', 10, 5, 1),
  ('2026-10-30', 0, 'viserai', 'view_ignored', 30, 10, 0);
select results_eq(
  $$select opponent, hero_id, games, wins, abandoned, total_games
      from public.fablazing_viserai_matchups where format = 0 order by opponent$$,
  $$values ('unknown_hero', null::uuid, 40::bigint, 20::bigint, 0::bigint, 140::bigint),
           ('view_hero', '40000000-0000-0000-0000-000000000fc1'::uuid, 70::bigint, 35::bigint, 5::bigint, 140::bigint)$$,
  'a hero''s forms count as one opponent, and ignored ids are left out'
);
delete from public.fablazing_matchup_daily where opponent in ('view_hero_transformed', 'view_ignored');

-- A rules change on 20 Oct starts a new window, so older days drop out.
update public.fablazing_rules_windows set ends_on = '2026-10-20' where ends_on is null;
insert into public.fablazing_rules_windows (starts_on, changes) values ('2026-10-20', 'A test ban.');
select results_eq(
  $$select starts_on from public.fablazing_window where format = 0$$,
  $$values ('2026-10-20'::date)$$,
  'a rules change starts a new window'
);
select results_eq(
  $$select decks from public.fablazing_card_stats where format = 0 and card = 'view_card_red'$$,
  $$values (20::bigint)$$,
  'card stats never cross a rules window boundary'
);

-- The app's roles read the views.
set local role anon;
select is((select count(*) from public.fablazing_viserai_matchups where format = 0), 2::bigint, 'anon reads the views');

select * from finish();
rollback;

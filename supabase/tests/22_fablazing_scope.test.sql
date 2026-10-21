-- FaBlazing history (docs/fablazing-plan.md, "Next steps" 3): days loaded from files that hold only
-- Viserai's games are recorded as such, carry only Viserai's own matchups, never replace a day that
-- had every game, and are replaced cleanly by a later run with every game.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select col_not_null('public', 'fablazing_runs', 'scope', 'every run has a scope');
select col_default_is('public', 'fablazing_runs', 'scope', 'all', 'a run covers every game unless it says otherwise');

grant usage on schema extensions to fablazing_ingest;
set local role fablazing_ingest;

-- A Viserai-only day: Viserai's rows and Viserai's own matchups.
select lives_ok(
  $$select public.fablazing_replace_day('2026-09-21', 0::smallint, '{
    "run": {"scope": "viserai", "games": 400, "abandoned": 10, "sides": 800, "sides_without_detail": 50,
            "viserai_sides": 420, "viserai_sides_without_detail": 20, "capped_sides": 3, "decks": {}},
    "cards": [{"card": "c_red", "side_at_end": "viserai_usurper", "decks": 30, "copies": 90,
               "result_decks": 29, "played": 70, "pitched": 5, "blocked": 3, "hits": 20, "wins": 15}],
    "matchups": [{"hero": "viserai", "opponent": "fang_dragonbound", "games": 40, "wins": 22, "abandoned": 1}]
  }'::jsonb)$$,
  'a Viserai-only day is written'
);
select is((select scope from public.fablazing_runs where date = '2026-09-21' and format = 0), 'viserai',
  'the run records that the day holds only Viserai''s games');

select throws_ok(
  $$select public.fablazing_replace_day('2026-09-21', 0::smallint, '{
    "run": {"scope": "viserai", "games": 1, "abandoned": 0, "sides": 2, "sides_without_detail": 0,
            "viserai_sides": 1, "viserai_sides_without_detail": 0, "capped_sides": 0, "decks": {}},
    "matchups": [{"hero": "fang_dragonbound", "opponent": "viserai", "games": 1, "wins": 1, "abandoned": 0}]
  }'::jsonb)$$,
  '23514', null, 'a Viserai-only day carries no other hero''s matchups'
);
select is((select games from public.fablazing_matchup_daily where date = '2026-09-21' and format = 0), 40,
  'a refused Viserai-only day keeps the old rows');

select throws_ok(
  $$select public.fablazing_replace_day('2026-09-21', 0::smallint, '{
    "run": {"scope": "some", "games": 1, "abandoned": 0, "sides": 2, "sides_without_detail": 0,
            "viserai_sides": 1, "viserai_sides_without_detail": 0, "capped_sides": 0, "decks": {}}}'::jsonb)$$,
  '23514', null, 'the scope is all or viserai'
);

-- A later run with every game (the daily Lambda sends no scope) replaces it whole.
select lives_ok(
  $$select public.fablazing_replace_day('2026-09-21', 0::smallint, '{
    "run": {"games": 5000, "abandoned": 120, "sides": 10000, "sides_without_detail": 900,
            "viserai_sides": 421, "viserai_sides_without_detail": 20, "capped_sides": 12, "decks": {}},
    "matchups": [{"hero": "viserai", "opponent": "fang_dragonbound", "games": 39, "wins": 21, "abandoned": 1},
                 {"hero": "dorinthea", "opponent": "bravo", "games": 90, "wins": 45, "abandoned": 2}]
  }'::jsonb)$$,
  'a full day replaces a Viserai-only one'
);
select results_eq(
  $$select scope, games from public.fablazing_runs where date = '2026-09-21' and format = 0$$,
  $$values ('all'::text, 5000)$$,
  'the run now covers every game'
);
select is((select count(*)::int from public.fablazing_matchup_daily where date = '2026-09-21' and format = 0), 2,
  'the full day''s matchups replace the Viserai-only ones');
select is((select count(*)::int from public.fablazing_card_daily where date = '2026-09-21' and format = 0), 0,
  'and its card rows replace the old ones');

-- A Viserai-only day never replaces one that had every game.
select throws_ok(
  $$select public.fablazing_replace_day('2026-09-21', 0::smallint, '{
    "run": {"scope": "viserai", "games": 400, "abandoned": 10, "sides": 800, "sides_without_detail": 50,
            "viserai_sides": 420, "viserai_sides_without_detail": 20, "capped_sides": 3, "decks": {}}}'::jsonb)$$,
  'FB001', null, 'a Viserai-only day doesn''t replace a full one'
);
select results_eq(
  $$select scope, games from public.fablazing_runs where date = '2026-09-21' and format = 0$$,
  $$values ('all'::text, 5000)$$,
  'the full day is kept'
);
reset role;

select * from finish();
rollback;

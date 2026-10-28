-- Exact table privileges per role. Hosted projects don't grant table access to anon and
-- authenticated by default (local stacks do), so every grant must be explicit.
begin;
create extension if not exists pgtap with schema extensions;
select plan(98);

select table_privs_are('public', 'deck_versions', 'anon', array[]::text[], 'anon has no access to deck versions');
select table_privs_are('public', 'deck_versions', 'authenticated', array['SELECT'], 'owners read versions, with only column updates');
select ok(has_column_privilege('authenticated', 'public.deck_versions', 'fabrary_url', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.deck_versions', 'snapshot', 'UPDATE'),
  'only the optional FaBrary link can be updated');
select ok(has_column_privilege('authenticated', 'public.deck_versions', 'name', 'UPDATE'),
  'owners can name a version');
select table_privs_are('public', 'deck_games', 'anon', array[]::text[], 'anon has no access to results');
select table_privs_are('public', 'deck_games', 'authenticated', array['SELECT', 'DELETE'], 'owners read and delete results, inserting and updating only some columns');
select ok(has_column_privilege('authenticated', 'public.deck_games', 'stats', 'INSERT')
  and has_column_privilege('authenticated', 'public.deck_games', 'deck_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.deck_games', 'uploaded_at', 'INSERT')
  and not has_column_privilege('authenticated', 'public.deck_games', 'id', 'INSERT'),
  'clients insert a game''s deck, version, file name, note and stats, not its id or upload time');
select ok(has_column_privilege('authenticated', 'public.deck_games', 'version_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.deck_games', 'stats', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.deck_games', 'deck_id', 'UPDATE'),
  'only a game''s version can be changed');

-- Public reference data: readable by everyone
select table_privs_are('public', t, 'anon', array['SELECT'], 'anon can only read ' || t)
  from unnest(array['cards', 'variants', 'score_dimensions', 'community_scores', 'app_settings']) t;
select table_privs_are('public', t, 'authenticated', array['SELECT'], 'signed-in users can only read ' || t)
  from unnest(array['cards', 'variants', 'score_dimensions', 'community_scores', 'app_settings']) t;

select table_privs_are('public', 'strategy_questions', 'anon', array['SELECT'], 'anon can only read strategy_questions');
select table_privs_are('public', 'strategy_questions', 'authenticated', array['SELECT'], 'signed-in users can only read strategy_questions');
select table_privs_are('public', 'strategy_answers', 'anon', array[]::text[], 'anon has no access to strategy_answers');
select table_privs_are('public', 'strategy_answers', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users manage their own strategy_answers');

-- Synergy (phase two): rule weights are public reference data, admins write them (row level
-- security); community edges and feedback are private to each person.
select table_privs_are('public', 'synergy_rule_weights', 'anon', array['SELECT'], 'anon can only read synergy_rule_weights');
select table_privs_are('public', 'synergy_rule_weights', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users read synergy_rule_weights (admins write, by row level security)');
select table_privs_are('public', t, 'anon', array[]::text[], 'anon has no access to ' || t)
  from unnest(array['card_synergies', 'synergy_feedback']) t;
select table_privs_are('public', t, 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users manage their own ' || t)
  from unnest(array['card_synergies', 'synergy_feedback']) t;

-- Community synergy results: written by the job (service role), readable by everyone.
select table_privs_are('public', t, 'anon', array['SELECT'], 'anon can only read ' || t)
  from unnest(array['community_synergies', 'community_synergy_feedback']) t;
select table_privs_are('public', t, 'authenticated', array['SELECT'], 'signed-in users can only read ' || t)
  from unnest(array['community_synergies', 'community_synergy_feedback']) t;

-- Saved scenarios (phase two): signed-in users manage their own (row level security); shared
-- ones are read through shared_scenario(), so anon has no table access.
select table_privs_are('public', t, 'anon', array[]::text[], 'anon has no access to ' || t)
  from unnest(array['scenarios', 'scenario_results']) t;
select table_privs_are('public', 'scenarios', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users manage their own scenarios');
select table_privs_are('public', 'scenario_results', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users manage their own scenario_results');

-- Plan goals (task 7c): owner only, like the plans (row level security).
select table_privs_are('public', 'plan_goals', 'anon', array[]::text[], 'anon has no access to plan_goals');
select table_privs_are('public', 'plan_goals', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users manage their own plan_goals');

-- Heroes (matchups): reference data the importer writes; everyone reads.
select table_privs_are('public', 'heroes', 'anon', array['SELECT'], 'anon can only read heroes');
select table_privs_are('public', 'heroes', 'authenticated', array['SELECT'], 'signed-in users can only read heroes');

-- Effect draft reviews (rules engine step 9b): everyone reads; admins write (row level security).
select table_privs_are('public', 'effect_draft_reviews', 'anon', array['SELECT'], 'anon can only read effect_draft_reviews');
select table_privs_are('public', 'effect_draft_reviews', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users read effect_draft_reviews (admins write, by row level security)');

-- FaBlazing game data: everyone reads it. Only the fablazing_ingest role (the Go Lambda) writes
-- the daily tables and runs; the importer (service role) fills the card map; rules windows are
-- written in migrations.
select table_privs_are('public', t, 'anon', array['SELECT'], 'anon can only read ' || t)
  from unnest(array['fablazing_runs', 'fablazing_card_map', 'fablazing_card_daily', 'fablazing_matchup_daily',
                    'fablazing_turn_daily', 'fablazing_traverse_daily', 'fablazing_rules_windows']) t;
select table_privs_are('public', t, 'authenticated', array['SELECT'], 'signed-in users can only read ' || t)
  from unnest(array['fablazing_runs', 'fablazing_card_map', 'fablazing_card_daily', 'fablazing_matchup_daily',
                    'fablazing_turn_daily', 'fablazing_traverse_daily', 'fablazing_rules_windows']) t;
select table_privs_are('public', t, 'fablazing_ingest', array['SELECT', 'INSERT', 'DELETE'], 'the ingest role replaces days of ' || t)
  from unnest(array['fablazing_card_daily', 'fablazing_matchup_daily', 'fablazing_turn_daily',
                    'fablazing_traverse_daily']) t;
select table_privs_are('public', 'fablazing_runs', 'fablazing_ingest', array['SELECT', 'INSERT', 'UPDATE'], 'the ingest role records runs');
select table_privs_are('public', t, 'fablazing_ingest', array['SELECT'], 'the ingest role can only read ' || t)
  from unnest(array['fablazing_card_map', 'fablazing_rules_windows']) t;
-- FaBlazing app views (a rolling window over the tables above): read only, for everyone.
select table_privs_are('public', t, r, array['SELECT'], r || ' can only read ' || t)
  from unnest(array['fablazing_window', 'fablazing_viserai_baseline', 'fablazing_card_stats',
                    'fablazing_viserai_matchups']) t
 cross join unnest(array['anon', 'authenticated']) r;

-- Private tables: nothing for anon
select table_privs_are('public', t, 'anon', array[]::text[], 'anon has no access to ' || t)
  from unnest(array['profiles', 'rater_weights', 'card_scores', 'card_reviews', 'deck_loadouts', 'loadout_cards', 'job_nonces']) t;
-- Public decks: anon can read them (row level security limits it to public ones)
select table_privs_are('public', t, 'anon', array['SELECT'], 'anon can only read ' || t || ' (public ones, by row level security)')
  from unnest(array['decks', 'deck_cards']) t;

-- Signed-in users: row level security decides which rows
select table_privs_are('public', t, 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users manage their own ' || t)
  from unnest(array['card_scores', 'card_reviews', 'decks', 'deck_cards', 'deck_loadouts', 'loadout_cards']) t;
select table_privs_are('public', 'job_nonces', 'authenticated', array[]::text[], 'signed-in users have no access to job_nonces');
-- Failed username sign-ins, for limiting guesses: the server only.
select table_privs_are('public', 'sign_in_failures', 'anon', array[]::text[], 'anon has no access to sign_in_failures');
select table_privs_are('public', 'sign_in_failures', 'authenticated', array[]::text[], 'signed-in users have no access to sign_in_failures');
select ok(
  has_table_privilege('service_role', 'public.sign_in_failures', 'INSERT')
  and has_table_privilege('service_role', 'public.sign_in_failures', 'SELECT'),
  'the server records and counts failed sign-ins'
);
select table_privs_are('public', t, 'authenticated', array['SELECT'], 'signed-in users can read (and only column-update) ' || t)
  from unnest(array['profiles', 'rater_weights']) t;

-- The server
select ok(
  has_table_privilege('service_role', 'public.card_scores', 'SELECT')
  and has_table_privilege('service_role', 'public.community_scores', 'INSERT'),
  'the service role can read scores and write community scores'
);
select ok(
  has_column_privilege('authenticated', 'public.cards', 'fringe', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.cards', 'name', 'UPDATE'),
  'signed-in users can only update the fringe column of cards (row level security limits it to curators)'
);

select table_privs_are('public', 'sign_in_limits', 'anon', array[]::text[], 'anon has no access to sign-in budgets');
select table_privs_are('public', 'sign_in_limits', 'authenticated', array[]::text[], 'signed-in users have no access to sign-in budgets');

select table_privs_are('public', 'community_job_gate', 'anon', array[]::text[], 'anon cannot access the community job gate');
select table_privs_are('public', 'community_job_gate', 'authenticated', array[]::text[], 'signed-in users cannot access the community job gate');

select * from finish();
rollback;

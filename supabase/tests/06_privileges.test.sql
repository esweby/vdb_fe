-- Exact table privileges per role. Hosted projects don't grant table access to anon and
-- authenticated by default (local stacks do), so every grant must be explicit.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Public reference data: readable by everyone
select table_privs_are('public', t, 'anon', array['SELECT'], 'anon can only read ' || t)
  from unnest(array['cards', 'variants', 'score_dimensions', 'community_scores', 'app_settings']) t;
select table_privs_are('public', t, 'authenticated', array['SELECT'], 'signed-in users can only read ' || t)
  from unnest(array['cards', 'variants', 'score_dimensions', 'community_scores', 'app_settings']) t;

select table_privs_are('public', 'strategy_questions', 'anon', array['SELECT'], 'anon can only read strategy_questions');
select table_privs_are('public', 'strategy_questions', 'authenticated', array['SELECT'], 'signed-in users can only read strategy_questions');
select table_privs_are('public', 'strategy_answers', 'anon', array[]::text[], 'anon has no access to strategy_answers');
select table_privs_are('public', 'strategy_answers', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'signed-in users manage their own strategy_answers');

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

select * from finish();
rollback;

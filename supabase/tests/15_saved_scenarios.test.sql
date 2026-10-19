-- Saved scenarios (README "Saved scenarios", phase two step 6): private by default, shared by
-- link (read by id only), or in the library, which only curators and admins set. Each person's
-- latest result per scenario and deck, with every input recorded.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

select has_table('public', 'scenarios', 'saved scenarios live in scenarios');
select has_table('public', 'scenario_results', 'their results live in scenario_results');
select col_default_is('public', 'scenarios', 'visibility', 'private'::text, 'a scenario is private by default');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'sc-owner@test.local'),
  ('00000000-0000-0000-0000-0000000007a2', 'sc-other@test.local'),
  ('00000000-0000-0000-0000-0000000007a3', 'sc-curator@test.local');
update public.profiles set role = 'curator' where id = '00000000-0000-0000-0000-0000000007a3';

-- Limits
select throws_ok(
  $$insert into public.scenarios (user_id, name, definition, definition_version)
    values ('00000000-0000-0000-0000-0000000007a1', ' ', '{}', 1)$$,
  '23514', null, 'a name is not blank'
);
select throws_ok(
  $$insert into public.scenarios (user_id, name, definition, definition_version)
    values ('00000000-0000-0000-0000-0000000007a1', repeat('x', 121), '{}', 1)$$,
  '23514', null, 'a name is at most 120 characters'
);
select throws_ok(
  $$insert into public.scenarios (user_id, name, definition, definition_version)
    values ('00000000-0000-0000-0000-0000000007a1', 'Big', jsonb_build_object('x', repeat('x', 20001)), 1)$$,
  '23514', null, 'a definition is at most 20 KB'
);
select throws_ok(
  $$insert into public.scenarios (user_id, name, definition, definition_version, visibility)
    values ('00000000-0000-0000-0000-0000000007a1', 'Odd', '{}', 1, 'public')$$,
  '23514', null, 'visibility is private, link or library'
);

-- Fixtures: the other person's private, link and library scenarios, and a deck of the owner's.
insert into public.scenarios (id, user_id, name, definition, definition_version, visibility) values
  ('20000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007a2', 'Theirs, private', '{}', 1, 'private'),
  ('20000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007a2', 'Theirs, by link', '{}', 1, 'link'),
  ('20000000-0000-0000-0000-0000000007b3', '00000000-0000-0000-0000-0000000007a2', 'In the library', '{}', 1, 'library');
insert into public.decks (id, user_id, name) values
  ('30000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007a1', 'Scenario deck'),
  ('30000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-0000000007a2', 'Someone else''s private deck');

-- The owner
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.scenarios (id, name, definition, definition_version)
    values ('20000000-0000-0000-0000-0000000007c1', 'Mine', '{"version":1}', 1)$$,
  'a signed-in user saves a scenario'
);
select is(
  (select array_agg(name order by name) from public.scenarios),
  array['In the library', 'Mine'],
  'and sees their own and the library''s, not others'' private or link scenarios'
);
select throws_ok(
  $$update public.scenarios set visibility = 'library' where id = '20000000-0000-0000-0000-0000000007c1'$$,
  '42501', null, 'only curators put a scenario in the library'
);
select throws_ok(
  $$insert into public.scenarios (name, definition, definition_version, visibility)
    values ('Straight in', '{}', 1, 'library')$$,
  '42501', null, 'or save one straight into it'
);
select lives_ok(
  $$update public.scenarios set visibility = 'link', name = 'Mine, shared' where id = '20000000-0000-0000-0000-0000000007c1'$$,
  'but anyone shares their own by link'
);
update public.scenarios set name = 'Hijacked' where id = '20000000-0000-0000-0000-0000000007b3';
delete from public.scenarios where id = '20000000-0000-0000-0000-0000000007b3';
select is(
  (select name from public.scenarios where id = '20000000-0000-0000-0000-0000000007b3'),
  'In the library',
  'nobody changes or deletes someone else''s scenario'
);
select is(
  (select name from public.shared_scenario('20000000-0000-0000-0000-0000000007b2')),
  'Theirs, by link',
  'a link scenario is read by its id'
);
select is(
  (select count(*)::int from public.shared_scenario('20000000-0000-0000-0000-0000000007b1')),
  0,
  'a private one isn''t, even by id'
);
select is(
  (select is_mine from public.shared_scenario('20000000-0000-0000-0000-0000000007c1')),
  true,
  'but the owner reads their own by id, marked as theirs'
);
select throws_ok(
  $$select public.set_scenario_library('20000000-0000-0000-0000-0000000007b2', true)$$,
  '42501', null, 'only curators promote a scenario'
);

-- Results: the latest per scenario and deck
select lives_ok(
  $$insert into public.scenario_results
      (scenario_id, deck_id, deck_snapshot, definition, definition_version, seed, runs, engine_version, results)
    values ('20000000-0000-0000-0000-0000000007b3', '30000000-0000-0000-0000-0000000007d1',
            '[]', '{}', 1, 1, 10000, '0.1.0', '{"successRate":0.5}')$$,
  'a user records a result for a library scenario on their deck'
);
select throws_ok(
  $$insert into public.scenario_results
      (scenario_id, deck_id, deck_snapshot, definition, definition_version, seed, runs, engine_version, results)
    values ('20000000-0000-0000-0000-0000000007b3', '30000000-0000-0000-0000-0000000007d1',
            '[]', '{}', 1, 1, 10000, '0.1.0', '{}')$$,
  '23505', null, 'one result per person, scenario and deck: a re-run replaces it'
);
select throws_ok(
  $$insert into public.scenario_results
      (scenario_id, deck_id, deck_snapshot, definition, definition_version, seed, runs, engine_version, results)
    values ('20000000-0000-0000-0000-0000000007b1', '30000000-0000-0000-0000-0000000007d1',
            '[]', '{}', 1, 1, 10000, '0.1.0', '{}')$$,
  '42501', null, 'not for a scenario they can''t see'
);
select throws_ok(
  $$insert into public.scenario_results
      (scenario_id, deck_id, deck_snapshot, definition, definition_version, seed, runs, engine_version, results)
    values ('20000000-0000-0000-0000-0000000007c1', '30000000-0000-0000-0000-0000000007d1',
            '[]', '{}', 1, 1, 1000001, '0.1.0', '{}')$$,
  '23514', null, 'runs are limited'
);
select throws_ok(
  $$insert into public.scenario_results
      (scenario_id, deck_id, deck_snapshot, definition, definition_version, seed, runs, engine_version, results)
    values ('20000000-0000-0000-0000-0000000007c1', '30000000-0000-0000-0000-0000000007d2',
            '[]', '{}', 1, 1, 10000, '0.1.0', '{}')$$,
  '42501', null, 'not on a deck they can''t see'
);
select lives_ok(
  $$update public.scenario_results set results = '{"successRate":0.6}'
     where scenario_id = '20000000-0000-0000-0000-0000000007b3'$$,
  'a re-run replaces their result'
);

-- Someone else
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a2","role":"authenticated"}', true);
select is((select count(*)::int from public.scenario_results), 0, 'results are private');

-- A curator
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a3","role":"authenticated"}', true);
select lives_ok(
  $$select public.set_scenario_library('20000000-0000-0000-0000-0000000007c1', true)$$,
  'a curator promotes a shared scenario to the library'
);
select is(
  (select visibility from public.scenarios where id = '20000000-0000-0000-0000-0000000007c1'),
  'library',
  'and it''s in the library'
);
select throws_ok(
  $$select public.set_scenario_library('20000000-0000-0000-0000-0000000007b1', true)$$,
  'P0002', null, 'but never a private one'
);

-- The owner again: a curated scenario stays as the curators picked it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);
select throws_ok(
  $$update public.scenarios set definition = '{"changed":true}' where id = '20000000-0000-0000-0000-0000000007c1'$$,
  '42501', null, 'an owner can''t change a scenario while it''s in the library'
);
select lives_ok(
  $$update public.scenarios set visibility = 'link' where id = '20000000-0000-0000-0000-0000000007c1'$$,
  'but can take it out'
);

-- And a curator takes one back out
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a3","role":"authenticated"}', true);
select public.set_scenario_library('20000000-0000-0000-0000-0000000007b3', false);
select is(
  (select visibility from public.scenarios where id = '20000000-0000-0000-0000-0000000007b3'),
  null,
  'a curator takes a scenario out of the library, back to link only (no longer listed)'
);

-- Signed out
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(
  (select name from public.shared_scenario('20000000-0000-0000-0000-0000000007b2')),
  'Theirs, by link',
  'anyone with the link can view it, signed out too'
);

select * from finish();
rollback;

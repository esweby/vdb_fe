-- Plan goals (task 7c): a target success rate for a scenario on a sideboard plan. Owner only,
-- like the plans themselves.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);
select has_table('public', 'plan_goals', 'plan goals have a table');
select ok((select relrowsecurity from pg_class where oid = 'public.plan_goals'::regclass), 'plan goals have row level security');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000029a1', 'goal-owner@test.local'),
  ('00000000-0000-0000-0000-0000000029a2', 'goal-other@test.local');
insert into public.decks (id, user_id, name, visibility) values
  ('30000000-0000-0000-0000-0000000029d1', '00000000-0000-0000-0000-0000000029a1', 'Goals deck', 'public');
insert into public.deck_loadouts (id, deck_id, name) values
  ('50000000-0000-0000-0000-0000000029b1', '30000000-0000-0000-0000-0000000029d1', 'Aggro plan');
insert into public.scenarios (id, user_id, name, definition, definition_version) values
  ('60000000-0000-0000-0000-0000000029e1', '00000000-0000-0000-0000-0000000029a1', 'Mine', '{}', 1),
  ('60000000-0000-0000-0000-0000000029e2', '00000000-0000-0000-0000-0000000029a2', 'Theirs', '{}', 1);
-- A library scenario of the other user's (the library guard is for curators; skipped here).
alter table public.scenarios disable trigger scenarios_guard_library;
insert into public.scenarios (id, user_id, name, definition, definition_version, visibility) values
  ('60000000-0000-0000-0000-0000000029e3', '00000000-0000-0000-0000-0000000029a2', 'Library', '{}', 1, 'library');
alter table public.scenarios enable trigger scenarios_guard_library;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000029a1","role":"authenticated"}', true);
select lives_ok($$insert into public.plan_goals (loadout_id, built_in, target) values
  ('50000000-0000-0000-0000-0000000029b1', 'Opening hand creates 3 or more Runechants', 40)$$, 'the owner names a built-in scenario');
select lives_ok($$insert into public.plan_goals (loadout_id, scenario_id, target) values
  ('50000000-0000-0000-0000-0000000029b1', '60000000-0000-0000-0000-0000000029e1', 25)$$, 'the owner names one of their scenarios');
select throws_ok($$insert into public.plan_goals (loadout_id, built_in, target) values
  ('50000000-0000-0000-0000-0000000029b1', 'Opening hand creates 3 or more Runechants', 50)$$, '23505', null, 'one goal per scenario on a plan');
select lives_ok($$insert into public.plan_goals (loadout_id, scenario_id, target) values
  ('50000000-0000-0000-0000-0000000029b1', '60000000-0000-0000-0000-0000000029e3', 1)$$, 'a library scenario can be named, and 1% is a target');
select throws_ok($$update public.plan_goals set scenario_id = '60000000-0000-0000-0000-0000000029e2'
  where scenario_id = '60000000-0000-0000-0000-0000000029e3'$$, '42501', null, 'a goal cannot be moved to another person''s private scenario');
select throws_ok($$insert into public.plan_goals (loadout_id, built_in, target) values
  ('50000000-0000-0000-0000-0000000029b1', repeat('x', 121), 30)$$, '23514', null, 'a built-in name is at most 120 characters');
select throws_ok($$insert into public.plan_goals (loadout_id, built_in, target) values
  ('50000000-0000-0000-0000-0000000029b1', 'Zero', 0)$$, '23514', null, 'a target of 0% is rejected');
select throws_ok($$insert into public.plan_goals (loadout_id, built_in, target) values
  ('50000000-0000-0000-0000-0000000029b1', 'All', 100)$$, '23514', null, 'a target of 100% is rejected');
select throws_ok($$insert into public.plan_goals (loadout_id, target) values
  ('50000000-0000-0000-0000-0000000029b1', 30)$$, '23514', null, 'a goal names a scenario');
select throws_ok($$insert into public.plan_goals (loadout_id, scenario_id, built_in, target) values
  ('50000000-0000-0000-0000-0000000029b1', '60000000-0000-0000-0000-0000000029e1', 'Both', 30)$$, '23514', null, 'a goal names only one scenario');
select throws_ok($$insert into public.plan_goals (loadout_id, built_in, target) values
  ((select id from public.deck_loadouts where deck_id = '30000000-0000-0000-0000-0000000029d1' and is_default), 'Main', 30)$$,
  '42501', null, 'goals go on sideboard plans, not the main deck');
select throws_ok($$insert into public.plan_goals (loadout_id, scenario_id, target) values
  ('50000000-0000-0000-0000-0000000029b1', '60000000-0000-0000-0000-0000000029e2', 30)$$, '42501', null, 'another person''s private scenario cannot be named');
select lives_ok($$insert into public.plan_goals (loadout_id, built_in, target)
  select '50000000-0000-0000-0000-0000000029b1', 'Goal ' || n, case n when 1 then 99 else 30 end from generate_series(1, 7) n$$, 'a plan holds up to 10 goals, and 99% is a target');
select throws_ok($$insert into public.plan_goals (loadout_id, built_in, target) values
  ('50000000-0000-0000-0000-0000000029b1', 'Goal 11', 30)$$, '23514', null, 'an 11th goal is rejected');
select lives_ok($$update public.plan_goals set target = 45 where built_in = 'Opening hand creates 3 or more Runechants'$$, 'the owner changes a target');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000029a2","role":"authenticated"}', true);
select is((select count(*)::int from public.plan_goals), 0, 'another user cannot read the goals');
select is((select count(*)::int from public.plan_goals where scenario_id = '60000000-0000-0000-0000-0000000029e3'), 0, 'not even on their own library scenario');
select throws_ok($$insert into public.plan_goals (loadout_id, built_in, target) values
  ('50000000-0000-0000-0000-0000000029b1', 'Theirs', 30)$$, '42501', null, 'another user cannot add goals to the plan');
update public.plan_goals set target = 10;
delete from public.plan_goals;

set local role anon;
select throws_ok($$select count(*) from public.plan_goals$$, '42501', null, 'anonymous visitors have no access');

reset role;
select is((select target::int from public.plan_goals where built_in = 'Opening hand creates 3 or more Runechants'), 45, 'another user cannot change or delete the goals');
delete from public.deck_loadouts where id = '50000000-0000-0000-0000-0000000029b1';
select is((select count(*)::int from public.plan_goals), 0, 'deleting a plan deletes its goals');
select * from finish();
rollback;

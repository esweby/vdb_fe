-- Synergy tables (docs/synergy-rules.md, README "Synergy graph"): community edges, feedback on
-- derived edges, and the rule weights admins tune.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select has_table('public', 'card_synergies', 'community edges live in card_synergies');
select has_table('public', 'synergy_feedback', 'feedback on derived edges lives in synergy_feedback');
select has_table('public', 'synergy_rule_weights', 'admin rule weights live in synergy_rule_weights');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'syn-scorer@test.local'),
  ('00000000-0000-0000-0000-0000000006a2', 'syn-other@test.local'),
  ('00000000-0000-0000-0000-0000000006a3', 'syn-admin@test.local');
update public.profiles set role = 'scorer' where id in ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006a2');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000006a3';

insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000006c1', 'ext-syn-1', 'Synergy One', 'action'),
  ('10000000-0000-0000-0000-0000000006c2', 'ext-syn-2', 'Synergy Two', 'action');

-- card_synergies: "from helps to", one row per person and direction
select throws_ok(
  $$insert into public.card_synergies (user_id, from_card_id, to_card_id, weight)
    values ('00000000-0000-0000-0000-0000000006a1', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c1', 0.5)$$,
  '23514', null, 'a card can''t help itself'
);
select throws_ok(
  $$insert into public.card_synergies (user_id, from_card_id, to_card_id, weight)
    values ('00000000-0000-0000-0000-0000000006a1', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 1.5)$$,
  '23514', null, 'a community edge weighs 0 to 1'
);
select throws_ok(
  $$insert into public.card_synergies (user_id, from_card_id, to_card_id, weight, note)
    values ('00000000-0000-0000-0000-0000000006a1', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 0.5, repeat('x', 281))$$,
  '23514', null, 'a note is at most 280 characters'
);

-- synergy_feedback: the README's CHECK
select throws_ok(
  $$insert into public.synergy_feedback (user_id, rule_id, from_card_id, to_card_id, verdict, weight)
    values ('00000000-0000-0000-0000-0000000006a1', 'gate-feeds-gate-target', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 'confirm', 0.5)$$,
  '23514', null, 'confirm takes no weight'
);
select throws_ok(
  $$insert into public.synergy_feedback (user_id, rule_id, from_card_id, to_card_id, verdict)
    values ('00000000-0000-0000-0000-0000000006a1', 'gate-feeds-gate-target', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 'reweight')$$,
  '23514', null, 'reweight needs a weight'
);
select throws_ok(
  $$insert into public.synergy_feedback (user_id, rule_id, from_card_id, to_card_id, verdict)
    values ('00000000-0000-0000-0000-0000000006a1', 'gate-feeds-gate-target', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 'maybe')$$,
  '23514', null, 'the verdict is confirm, reject or reweight'
);
select throws_ok(
  $$insert into public.synergy_feedback (user_id, rule_id, from_card_id, to_card_id, verdict)
    values ('00000000-0000-0000-0000-0000000006a1', 'Not A Rule!', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 'confirm')$$,
  '23514', null, 'a rule id is lower-case words joined by hyphens'
);

-- Fixtures for row level security
insert into public.card_synergies (user_id, from_card_id, to_card_id, weight) values
  ('00000000-0000-0000-0000-0000000006a2', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 0.4);
insert into public.synergy_feedback (user_id, rule_id, from_card_id, to_card_id, verdict) values
  ('00000000-0000-0000-0000-0000000006a2', 'gate-feeds-gate-target', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 'reject');

-- A scorer
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.card_synergies (from_card_id, to_card_id, weight, note)
    values ('10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 0.6, 'Gate plays it')$$,
  'a scorer adds a community edge'
);
select lives_ok(
  $$insert into public.synergy_feedback (rule_id, from_card_id, to_card_id, verdict, weight)
    values ('gate-feeds-gate-target', '10000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c2', 'reweight', 0.9)$$,
  'and reweights a derived edge'
);
select is((select count(*)::int from public.card_synergies), 1, 'and sees only their own community edges');
select is((select count(*)::int from public.synergy_feedback), 1, 'and only their own feedback');
select throws_ok(
  $$insert into public.card_synergies (user_id, from_card_id, to_card_id, weight)
    values ('00000000-0000-0000-0000-0000000006a2', '10000000-0000-0000-0000-0000000006c2', '10000000-0000-0000-0000-0000000006c1', 0.5)$$,
  '42501', null, 'nobody adds an edge for someone else'
);
select throws_ok(
  $$insert into public.synergy_rule_weights (rule_id, weight) values ('gate-feeds-gate-target', 0.5)$$,
  '42501', null, 'a scorer can''t set a rule weight'
);
reset role;

-- An admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a3","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.synergy_rule_weights (rule_id, weight) values ('gate-feeds-gate-target', 0.5)$$,
  'an admin sets a rule weight'
);
select lives_ok(
  $$update public.synergy_rule_weights set weight = 0.6 where rule_id = 'gate-feeds-gate-target'$$,
  'and changes it'
);
select is(
  (select updated_by from public.synergy_rule_weights where rule_id = 'gate-feeds-gate-target'),
  '00000000-0000-0000-0000-0000000006a3'::uuid,
  'the change records who made it'
);
select throws_ok(
  $$insert into public.synergy_rule_weights (rule_id, weight) values ('usurp-feeds-usurp-payoff', -0.1)$$,
  '23514', null, 'a rule weight is 0 to 1 (0 turns the rule off)'
);
select is((select count(*)::int from public.card_synergies), 0, 'an admin doesn''t see other people''s edges');
reset role;

-- Back to the scorer: they read the admin's weight, but changing it or someone else's edge
-- does nothing (row level security filters the rows out).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select is(
  (select weight from public.synergy_rule_weights where rule_id = 'gate-feeds-gate-target'),
  0.6::numeric, 'anyone signed in can read rule weights'
);
update public.synergy_rule_weights set weight = 0.1 where rule_id = 'gate-feeds-gate-target';
update public.card_synergies set weight = 0.1 where user_id = '00000000-0000-0000-0000-0000000006a2';
reset role;
select is(
  (select weight from public.synergy_rule_weights where rule_id = 'gate-feeds-gate-target'),
  0.6::numeric, 'a scorer''s change to a rule weight is ignored'
);
select is(
  (select weight from public.card_synergies where user_id = '00000000-0000-0000-0000-0000000006a2'),
  0.4::numeric, 'a scorer can''t change someone else''s edge'
);

-- Visitors
set local role anon;
select is(
  (select weight from public.synergy_rule_weights where rule_id = 'gate-feeds-gate-target'),
  0.6::numeric, 'visitors read rule weights, so the ranking works signed out'
);
select throws_ok($$select count(*) from public.card_synergies$$, '42501', null, 'visitors can''t read anyone''s edges');
reset role;

select * from finish();
rollback;

-- Community synergy results (docs/synergy-rules.md "Community feedback"): written only by the
-- community-scores job through replace_community_synergies, readable by everyone.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
select public.acquire_community_job(true);

select has_table('public', 'community_synergies', 'the scoring group''s edges live in community_synergies');
select has_table('public', 'community_synergy_feedback', 'their feedback on derived edges lives in community_synergy_feedback');

insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000007c1', 'ext-cs-1', 'Community One', 'action'),
  ('10000000-0000-0000-0000-0000000007c2', 'ext-cs-2', 'Community Two', 'action');

select lives_ok(
  $$select public.replace_community_synergies(
    '[{"fromCardId":"10000000-0000-0000-0000-0000000007c1","toCardId":"10000000-0000-0000-0000-0000000007c2","weight":0.6,"ratingCount":2,"totalWeight":3}]',
    '[{"ruleId":"gate-feeds-gate-target","fromCardId":"10000000-0000-0000-0000-0000000007c1","toCardId":"10000000-0000-0000-0000-0000000007c2","confirmShare":0.25,"fixedPart":0.25,"ratingCount":3,"totalWeight":4}]',
    1, (select token from public.community_job_gate))$$,
  'the job swaps in edges and feedback'
);
select results_eq(
  $$select weight, rating_count, synergies_version::int from public.community_synergies
     where from_card_id = '10000000-0000-0000-0000-0000000007c1'$$,
  $$values (0.6::numeric, 2, 1)$$,
  'an edge is stored with its weight, count and version'
);
select results_eq(
  $$select rule_id, confirm_share, fixed_part from public.community_synergy_feedback
     where from_card_id = '10000000-0000-0000-0000-0000000007c1'$$,
  $$values ('gate-feeds-gate-target'::text, 0.25::numeric, 0.25::numeric)$$,
  'feedback is stored as the confirm share and the fixed part'
);

select public.replace_community_synergies('[]', '[]', 2, (select token from public.community_job_gate));
select is((select count(*)::int from public.community_synergies), 0, 'the next run replaces every edge');
select is((select count(*)::int from public.community_synergy_feedback), 0, 'and all the feedback');

select throws_ok(
  $$select public.replace_community_synergies(
    '[{"fromCardId":"10000000-0000-0000-0000-0000000007c1","toCardId":"10000000-0000-0000-0000-0000000007c2","weight":1.5,"ratingCount":2,"totalWeight":3}]',
    '[]', 3, (select token from public.community_job_gate))$$,
  '23514', null, 'an edge weighs 0 to 1'
);

-- At least 2 people, so no single person's opinion shows.
select throws_ok(
  $$select public.replace_community_synergies(
    '[{"fromCardId":"10000000-0000-0000-0000-0000000007c1","toCardId":"10000000-0000-0000-0000-0000000007c2","weight":0.6,"ratingCount":1,"totalWeight":1}]',
    '[]', 3, (select token from public.community_job_gate))$$,
  '23514', null, 'a community edge needs at least 2 people'
);
select throws_ok(
  $$select public.replace_community_synergies('[]',
    '[{"ruleId":"gate-feeds-gate-target","fromCardId":"10000000-0000-0000-0000-0000000007c1","toCardId":"10000000-0000-0000-0000-0000000007c2","confirmShare":1,"fixedPart":0,"ratingCount":1,"totalWeight":1}]',
    3, (select token from public.community_job_gate))$$,
  '23514', null, 'so does feedback on a derived edge'
);
select throws_ok(
  $$select public.replace_community_synergies('[]',
    '[{"ruleId":"gate-feeds-gate-target","fromCardId":"10000000-0000-0000-0000-0000000007c1","toCardId":"10000000-0000-0000-0000-0000000007c2","confirmShare":1.2,"fixedPart":0,"ratingCount":2,"totalWeight":2}]',
    3, (select token from public.community_job_gate))$$,
  '23514', null, 'the confirm share is 0 to 1'
);

select public.replace_community_synergies(
  '[{"fromCardId":"10000000-0000-0000-0000-0000000007c1","toCardId":"10000000-0000-0000-0000-0000000007c2","weight":0.6,"ratingCount":2,"totalWeight":3}]',
  '[]', 4, (select token from public.community_job_gate));

set local role anon;
select is((select count(*)::int from public.community_synergies), 1, 'visitors read community edges');
select throws_ok(
  $$select public.replace_community_synergies('[]', '[]', 5, null)$$,
  '42501', null, 'visitors can''t run the swap'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select public.replace_community_synergies('[]', '[]', 5, null)$$,
  '42501', null, 'nor can signed-in users'
);
reset role;

select ok(
  has_function_privilege('service_role', 'public.replace_community_synergies(jsonb, jsonb, bigint, uuid)', 'EXECUTE'),
  'the server can run it'
);

select * from finish();
rollback;

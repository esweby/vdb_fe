-- replace_community_scores: the community score job's only write path (docs/phase-one.md M3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.cards (id, external_id, name, type)
  values ('10000000-0000-0000-0000-0000000000c1', 'job-card-1', 'Job Card', 'action');
insert into public.variants (id, card_id, external_id, pitch)
  values ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', 'job-v-1', 1);
insert into public.community_scores (card_id, variant_id, side, dimension_id, score, rating_count, total_weight, scores_version)
  values ('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'forsaken',
          (select id from public.score_dimensions where key = 'utility'), 10, 1, 1, 1);

-- Not callable by users
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'job@test.local');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$select public.replace_community_scores('[]'::jsonb, 2)$$,
  '42501', null, 'signed-in users cannot run the job'
);
reset role;
set local role anon;
select throws_ok(
  $$select public.replace_community_scores('[]'::jsonb, 2)$$,
  '42501', null, 'anonymous visitors cannot run the job'
);
reset role;

-- Callable by the server (service role)
set local role service_role;
select lives_ok(
  format(
    $$select public.replace_community_scores(%L::jsonb, 2)$$,
    json_build_array(json_build_object(
      'cardId', '10000000-0000-0000-0000-0000000000c1',
      'variantId', '20000000-0000-0000-0000-0000000000c1',
      'side', 'usurper',
      'dimensionId', (select id from public.score_dimensions where key = 'utility'),
      'score', 62.5, 'ratingCount', 2, 'totalWeight', 2
    ))::text
  ),
  'the service role can run the job'
);
reset role;

select is(
  (select count(*)::int from public.community_scores where card_id = '10000000-0000-0000-0000-0000000000c1'),
  1, 'old rows are replaced, not added to'
);
select is(
  (select row(side::text, score, rating_count, total_weight, scores_version)::text
     from public.community_scores where card_id = '10000000-0000-0000-0000-0000000000c1'),
  row('usurper', 62.50::numeric(5,2), 2, 2::numeric, 2::bigint)::text,
  'the new row is stored with its version'
);
select is(
  (select count(*)::int from public.community_scores where scores_version <> 2),
  0, 'every row carries the new version'
);

select * from finish();
rollback;

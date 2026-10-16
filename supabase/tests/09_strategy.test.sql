-- Strategy questions: asked once per person, not per card. Each person answers for themselves;
-- the scoring group's answers are averaged. Question wording is UNVERIFIED.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public', 'strategy_questions', 'strategy questions live in their own table');
select has_table('public', 'strategy_answers', 'answers live in their own table');
select ok(
  (select count(*) from public.strategy_questions
    where key in ('traverse_to_usurper', 'flip_back_to_forsaken')) = 2,
  'the first two questions are seeded'
);

-- Start from no answers, whatever the local database holds (rolled back at the end).
delete from public.strategy_answers;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'scorer-a@test.local'),
  ('00000000-0000-0000-0000-0000000005a2', 'scorer-b@test.local'),
  ('00000000-0000-0000-0000-0000000005a3', 'user-c@test.local');
update public.profiles set role = 'scorer'
 where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a2');

select throws_ok(
  $$insert into public.strategy_answers (user_id, question_key, answer)
    values ('00000000-0000-0000-0000-0000000005a1', 'traverse_to_usurper', 11)$$,
  '23514', null, 'answers run from 1 to 10'
);

insert into public.strategy_answers (user_id, question_key, answer) values
  ('00000000-0000-0000-0000-0000000005a1', 'traverse_to_usurper', 8),
  ('00000000-0000-0000-0000-0000000005a2', 'traverse_to_usurper', 6),
  ('00000000-0000-0000-0000-0000000005a3', 'traverse_to_usurper', 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.strategy_answers), 1,
  'a person sees only their own answers'
);
select is(
  (select answer::int from public.strategy_answers where question_key = 'traverse_to_usurper'), 8,
  'and can read their answer back'
);
select lives_ok(
  $$update public.strategy_answers set answer = 9 where question_key = 'traverse_to_usurper'$$,
  'and change it'
);
select throws_ok(
  $$insert into public.strategy_answers (user_id, question_key, answer)
    values ('00000000-0000-0000-0000-0000000005a2', 'flip_back_to_forsaken', 5)$$,
  '42501', null, 'nobody can answer for someone else'
);
select is(
  (select answer::int from public.strategy_answers where question_key = 'traverse_to_usurper'), 9,
  'the change is saved'
);
reset role;

set local role anon;
select is(
  (select count(*)::int from public.strategy_questions), 2,
  'anyone can read the questions'
);
select results_eq(
  $$select question_key, round(average, 1), answers::int
      from public.strategy_community_answers() where question_key = 'traverse_to_usurper'$$,
  $$values ('traverse_to_usurper'::text, 7.5::numeric, 2)$$,
  'the scoring group average counts scorers only (9 and 6), never single answers'
);
select is(
  (select count(*)::int from public.strategy_community_answers() where question_key = 'flip_back_to_forsaken'),
  0, 'a question nobody in the group has answered has no average'
);
reset role;

-- One answer alone would be that person's answer, so it isn't averaged (security audit, 16 Oct 2026).
insert into public.strategy_answers (user_id, question_key, answer)
  values ('00000000-0000-0000-0000-0000000005a1', 'flip_back_to_forsaken', 4);
select is(
  (select count(*)::int from public.strategy_community_answers() where question_key = 'flip_back_to_forsaken'),
  0, 'a question only one scorer has answered shows no average'
);

select * from finish();
rollback;

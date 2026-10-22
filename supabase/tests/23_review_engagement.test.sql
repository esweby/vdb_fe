-- Review engagement for admins: how many people use each reviewing area. Admins' own activity
-- is left out. Counts are compared with a baseline, as the local database may hold real rows.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023a1', 'eng-admin@test.local'),
  ('00000000-0000-0000-0000-0000000023a2', 'eng-one@test.local'),
  ('00000000-0000-0000-0000-0000000023a3', 'eng-two@test.local');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000023a1';

insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000023c1', 'ext-eng-1', 'Engage One', 'action'),
  ('10000000-0000-0000-0000-0000000023c2', 'ext-eng-2', 'Engage Two', 'action'),
  ('10000000-0000-0000-0000-0000000023c3', 'ext-eng-3', 'Engage Three', 'action');

create temp table baseline as select * from public.admin_review_engagement() where false;
create temp table after as select * from public.admin_review_engagement() where false;
create temp table daily_before as select * from public.admin_review_engagement_daily(14) where false;
grant all on baseline, after, daily_before to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
insert into baseline select * from public.admin_review_engagement();
insert into daily_before select * from public.admin_review_engagement_daily(14);
reset role;

-- Activity: two people (one with an old review), and the admin's own, which doesn't count.
insert into public.card_reviews (user_id, card_id, reviewed_at) values
  ('00000000-0000-0000-0000-0000000023a2', '10000000-0000-0000-0000-0000000023c1', now()),
  ('00000000-0000-0000-0000-0000000023a2', '10000000-0000-0000-0000-0000000023c2', now()),
  ('00000000-0000-0000-0000-0000000023a3', '10000000-0000-0000-0000-0000000023c1', now()),
  ('00000000-0000-0000-0000-0000000023a3', '10000000-0000-0000-0000-0000000023c2', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000023a1', '10000000-0000-0000-0000-0000000023c1', now());
insert into public.synergy_feedback (user_id, rule_id, from_card_id, to_card_id, verdict) values
  ('00000000-0000-0000-0000-0000000023a2', 'some-rule', '10000000-0000-0000-0000-0000000023c1', '10000000-0000-0000-0000-0000000023c2', 'confirm'),
  ('00000000-0000-0000-0000-0000000023a1', 'some-rule', '10000000-0000-0000-0000-0000000023c1', '10000000-0000-0000-0000-0000000023c3', 'confirm');
insert into public.card_synergies (user_id, from_card_id, to_card_id, weight) values
  ('00000000-0000-0000-0000-0000000023a1', '10000000-0000-0000-0000-0000000023c1', '10000000-0000-0000-0000-0000000023c2', 0.5);

-- A regular user can't read it
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a2","role":"authenticated"}', true);
select throws_ok($$select * from public.admin_review_engagement()$$, '42501', null, 'a regular user can''t read engagement');
select throws_ok($$select * from public.admin_review_engagement_daily(7)$$, '42501', null, 'nor the daily figures');
reset role;

-- An admin can
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
insert into after select * from public.admin_review_engagement();
select is((select count(*) from public.admin_review_engagement()), 4::bigint, 'an admin gets one row per area');
select is(
  (select array_agg(area order by area) from public.admin_review_engagement()),
  array['Card scoring', 'Strategy questions', 'Synergy links added', 'Synergy verdicts'],
  'the four areas'
);
select is(
  (select people - (select people from baseline b where b.area = 'Card scoring') from after where area = 'Card scoring'),
  2::bigint, 'two people scored cards, the admin left out'
);
select is(
  (select items - (select items from baseline b where b.area = 'Card scoring') from after where area = 'Card scoring'),
  4::bigint, 'four cards scored by them'
);
select is(
  (select items_last_7d - (select items_last_7d from baseline b where b.area = 'Card scoring') from after where area = 'Card scoring'),
  3::bigint, 'three of them in the last 7 days'
);
select is(
  (select items - (select items from baseline b where b.area = 'Synergy verdicts') from after where area = 'Synergy verdicts'),
  1::bigint, 'one verdict, the admin''s left out'
);
select is(
  (select items - (select items from baseline b where b.area = 'Synergy links added') from after where area = 'Synergy links added'),
  0::bigint, 'the admin''s own link isn''t counted'
);
select is(
  (select sum(items) from public.admin_review_engagement_daily(14) where area = 'Card scoring')
    - (select coalesce(sum(items), 0) from daily_before where area = 'Card scoring'),
  3::numeric, 'the daily figures cover the last 14 days only'
);
reset role;

select ok(
  not has_function_privilege('anon', 'public.admin_review_engagement()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_review_engagement()', 'EXECUTE'),
  'only signed-in users can call it (admins, by the check inside)'
);

select ok(
  not has_function_privilege('anon', 'public.admin_review_engagement_daily(int)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_review_engagement_daily(int)', 'EXECUTE'),
  'the same for the daily figures'
);

select * from finish();
rollback;

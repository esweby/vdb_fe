-- Usernames can't be changed once set (maintainer, 20 Oct 2026: "Usernames shouldn't be changeable
-- after registration"). An account without one (older accounts, or a sign-up whose name was taken)
-- can still set it, once.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000018a1', 'named@test.local', '{"username": "Named_1"}'),
  ('00000000-0000-0000-0000-0000000018a2', 'blank@test.local', '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated"}', true);
select throws_ok(
  $$update public.profiles set username = 'Renamed' where id = '00000000-0000-0000-0000-0000000018a1'$$,
  'P0001', 'A username can''t be changed once it''s set.',
  'a set username can''t be changed'
);
select throws_ok(
  $$update public.profiles set username = null where id = '00000000-0000-0000-0000-0000000018a1'$$,
  'P0001', 'A username can''t be changed once it''s set.',
  'or cleared'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000018a2","role":"authenticated"}', true);
select lives_ok(
  $$update public.profiles set username = 'Late_1' where id = '00000000-0000-0000-0000-0000000018a2'$$,
  'an account without one can set it'
);
select throws_ok(
  $$update public.profiles set username = 'Late_2' where id = '00000000-0000-0000-0000-0000000018a2'$$,
  'P0001', 'A username can''t be changed once it''s set.',
  'but only once'
);
reset role;

select * from finish();
rollback;

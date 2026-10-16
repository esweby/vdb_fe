-- Optional usernames (maintainer, 16 Oct 2026): chosen at sign-up or on the Account page, shown
-- as the author of public decks. Profiles stay private; only usernames are readable by others.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_column('public', 'profiles', 'username', 'profiles have an optional username');

-- Chosen at sign-up: passed as user metadata, copied by the new-user trigger.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000012a1', 'edd@test.local', '{"username": "Edd_99"}');
select is(
  (select username from public.profiles where id = '00000000-0000-0000-0000-0000000012a1'),
  'Edd_99', 'a username chosen at sign-up is saved'
);

-- A bad or taken username never blocks sign-up: the account is made without one.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000012a2', 'bad@test.local', '{"username": "no spaces!"}'),
  ('00000000-0000-0000-0000-0000000012a3', 'taken@test.local', '{"username": "EDD_99"}'),
  ('00000000-0000-0000-0000-0000000012a4', 'none@test.local', '{}');
select ok(
  (select bool_and(username is null) from public.profiles
    where id in ('00000000-0000-0000-0000-0000000012a2', '00000000-0000-0000-0000-0000000012a3',
                 '00000000-0000-0000-0000-0000000012a4')),
  'an invalid, taken (in any case) or missing username leaves it blank, and the account is still made'
);

-- The rules hold however it's written.
select throws_ok(
  $$update public.profiles set username = 'ab' where id = '00000000-0000-0000-0000-0000000012a2'$$,
  '23514', null, 'a username is at least 3 characters'
);
select throws_ok(
  $$update public.profiles set username = repeat('a', 25) where id = '00000000-0000-0000-0000-0000000012a2'$$,
  '23514', null, 'and at most 24'
);
select throws_ok(
  $$update public.profiles set username = 'bad name' where id = '00000000-0000-0000-0000-0000000012a2'$$,
  '23514', null, 'and only letters, numbers, _ and -'
);
select throws_ok(
  $$update public.profiles set username = 'edd_99' where id = '00000000-0000-0000-0000-0000000012a2'$$,
  '23505', null, 'and unique, ignoring case'
);

-- People change their own username, and nobody else's.
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'signed-in users can update their username, still not their role'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000012a4","role":"authenticated"}', true);
update public.profiles set username = 'Newbie' where id = '00000000-0000-0000-0000-0000000012a4';
update public.profiles set username = 'Hijack' where id = '00000000-0000-0000-0000-0000000012a1';
reset role;
select is(
  (select array_agg(username order by id) from public.profiles
    where id in ('00000000-0000-0000-0000-0000000012a1', '00000000-0000-0000-0000-0000000012a4')),
  array['Edd_99', 'Newbie'], 'a user sets their own username and can''t change someone else''s'
);

-- Anyone can read usernames (for deck authors), and only usernames.
set local role anon;
select results_eq(
  $$select id, username from public.usernames(array['00000000-0000-0000-0000-0000000012a1'::uuid])$$,
  $$values ('00000000-0000-0000-0000-0000000012a1'::uuid, 'Edd_99'::text)$$,
  'anyone can look up usernames by id'
);
select is(public.username_available('edd_99'), false, 'a taken username, in any case, is not available');
select is(public.username_available('Fresh-1'), true, 'a free one is');
select is(public.username_available('no'), false, 'an invalid one is not');
reset role;

select * from finish();
rollback;

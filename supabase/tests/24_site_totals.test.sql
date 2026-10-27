-- Site totals for admins: counts only, admins' own users and decks left out. Compared with a
-- baseline, as the local database may hold real rows.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000024a1', 'tot-admin@test.local');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000024a1';

create temp table baseline as select * from public.admin_site_totals() where false;
grant all on baseline to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated"}', true);
insert into baseline select * from public.admin_site_totals();
reset role;

-- Two people (one joined a month ago), one with three decks (private, link only and public), and the admin's own public deck.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000024a2', 'tot-one@test.local'),
  ('00000000-0000-0000-0000-0000000024a3', 'tot-two@test.local');
update public.profiles set created_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-0000000024a3';
insert into public.decks (user_id, name, visibility) values
  ('00000000-0000-0000-0000-0000000024a2', 'Private deck', 'private'),
  ('00000000-0000-0000-0000-0000000024a2', 'Link-only deck', 'link'),
  ('00000000-0000-0000-0000-0000000024a2', 'Public deck', 'public'),
  ('00000000-0000-0000-0000-0000000024a1', 'Admin deck', 'public');

-- Not callable by anon
select ok(
  not has_function_privilege('anon', 'public.admin_site_totals()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_site_totals()', 'EXECUTE'),
  'only signed-in users can call it (admins, by the check inside)'
);
set local role anon;
select throws_ok($$select * from public.admin_site_totals()$$, '42501', null, 'anon can''t call it');
reset role;

-- A regular user gets the error
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a2","role":"authenticated"}', true);
select throws_ok($$select * from public.admin_site_totals()$$, '42501', 'Admins only', 'a regular user can''t read the totals');
reset role;

-- An admin gets the counts, admins left out
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated"}', true);
select is((select users from public.admin_site_totals()) - (select users from baseline), 2::bigint, 'two new users, the admin left out');
select is((select users_last_7d from public.admin_site_totals()) - (select users_last_7d from baseline), 1::bigint, 'one of them joined in the last 7 days');
select is((select decks from public.admin_site_totals()) - (select decks from baseline), 3::bigint, 'three decks, the admin''s left out');
select is((select public_decks from public.admin_site_totals()) - (select public_decks from baseline), 1::bigint, 'one of them public: a link-only deck isn''t listed');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a
    where a.attrelid = 'pg_temp.baseline'::regclass and a.attnum > 0),
  array['users', 'users_last_7d', 'decks', 'public_decks'],
  'counts only: no ids, names or emails'
);
reset role;

select * from finish();
rollback;

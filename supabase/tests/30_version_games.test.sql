-- Games uploaded onto a deck version: a Talishar stats CSV, parsed in the browser, stored
-- with an optional note. Private to the deck's owner (docs/test-loop.md, step 2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table('public', 'version_games', 'versions have uploaded games');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000030a1', 'game-owner@test.local'),
  ('00000000-0000-0000-0000-0000000030a2', 'game-other@test.local');
insert into public.decks (id, user_id, name, visibility) values
  ('30000000-0000-0000-0000-0000000030d1', '00000000-0000-0000-0000-0000000030a1', 'Game deck', 'public');
insert into public.deck_versions (id, deck_id, number, snapshot) values
  ('60000000-0000-0000-0000-0000000030e1', '30000000-0000-0000-0000-0000000030d1', 1, '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}', true);
select lives_ok($$insert into public.version_games (version_id, file_name, note, stats)
  values ('60000000-0000-0000-0000-0000000030e1', 'game-stats-2026-10-22T14-46-08.csv', 'Kept a slow hand', '{"summary":{"result":"loss"}}')$$,
  'the owner uploads a game onto a version');
select is((select note from public.version_games), 'Kept a slow hand', 'the note is stored');
select is((select stats->'summary'->>'result' from public.version_games), 'loss', 'the parsed stats are stored');
select ok((select uploaded_at is not null from public.version_games), 'the upload time is set');
select lives_ok($$insert into public.version_games (version_id, stats) values ('60000000-0000-0000-0000-0000000030e1', '{}')$$,
  'the note and file name are optional');
select throws_ok($$insert into public.version_games (version_id, stats, uploaded_at) values ('60000000-0000-0000-0000-0000000030e1', '{}', '2020-01-01')$$,
  '42501', null, 'clients cannot set the upload time');
select throws_ok($$insert into public.version_games (version_id, stats) values ('60000000-0000-0000-0000-0000000030e1', '[]')$$,
  '23514', null, 'stats must be an object');
select throws_ok($$insert into public.version_games (version_id, note, stats) values ('60000000-0000-0000-0000-0000000030e1', repeat('x', 501), '{}')$$,
  '23514', null, 'notes are at most 500 characters');
select throws_ok($$insert into public.version_games (version_id, stats) values ('60000000-0000-0000-0000-0000000030e1', jsonb_build_object('pad', repeat('x', 100001)))$$,
  '23514', null, 'stats are at most 100 kB');
select throws_ok($$insert into public.version_games (version_id, file_name, stats) values ('60000000-0000-0000-0000-0000000030e1', repeat('x', 201), '{}')$$,
  '23514', null, 'file names are at most 200 characters');
select throws_ok($$update public.version_games set note = 'changed'$$, '42501', null, 'an uploaded game cannot be rewritten');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030a2","role":"authenticated"}', true);
select is((select count(*)::int from public.version_games), 0, 'another user cannot read games, even on a public deck');
select throws_ok($$insert into public.version_games (version_id, stats) values ('60000000-0000-0000-0000-0000000030e1', '{}')$$,
  '42501', null, 'another user cannot upload onto the owner''s version');
with gone as (delete from public.version_games returning id)
select is((select count(*)::int from gone), 0, 'another user cannot delete games');

set local role anon;
select throws_ok($$select * from public.version_games$$, '42501', null, 'anonymous visitors cannot read games');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}', true);
with gone as (delete from public.version_games where note is null returning id)
select is((select count(*)::int from gone), 1, 'the owner can delete a game');

reset role;
insert into public.deck_versions (id, deck_id, number, snapshot) values
  ('60000000-0000-0000-0000-0000000030e2', '30000000-0000-0000-0000-0000000030d1', 2, '{}');
insert into public.version_games (version_id, stats) values ('60000000-0000-0000-0000-0000000030e2', '{}');
delete from public.deck_versions where id = '60000000-0000-0000-0000-0000000030e2';
select is((select count(*)::int from public.version_games where version_id = '60000000-0000-0000-0000-0000000030e2'), 0, 'deleting a version deletes its games');
delete from public.decks where id = '30000000-0000-0000-0000-0000000030d1';
select is((select count(*)::int from public.version_games), 0, 'deleting a deck deletes its versions'' games');
select is((select count(*)::int from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000030d1'), 0, 'and its versions');

select * from finish();
rollback;

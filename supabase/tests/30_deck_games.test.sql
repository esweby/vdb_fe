-- A deck's results: Talishar stats CSVs, parsed in the browser and stored with an optional
-- note, each optionally tied to one of the deck's versions. Private to the deck's owner
-- (docs/test-loop.md, step 2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

select has_table('public', 'deck_games', 'decks have uploaded results');
select hasnt_table('public', 'version_games', 'games belong to the deck, not only to a version');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000030a1', 'game-owner@test.local'),
  ('00000000-0000-0000-0000-0000000030a2', 'game-other@test.local');
insert into public.decks (id, user_id, name, visibility) values
  ('30000000-0000-0000-0000-0000000030d1', '00000000-0000-0000-0000-0000000030a1', 'Game deck', 'public'),
  ('30000000-0000-0000-0000-0000000030d2', '00000000-0000-0000-0000-0000000030a1', 'Other deck', 'private');
insert into public.deck_versions (id, deck_id, number, snapshot) values
  ('60000000-0000-0000-0000-0000000030e1', '30000000-0000-0000-0000-0000000030d1', 1, '{}'),
  ('60000000-0000-0000-0000-0000000030e2', '30000000-0000-0000-0000-0000000030d1', 2, '{}'),
  ('60000000-0000-0000-0000-0000000030e9', '30000000-0000-0000-0000-0000000030d2', 1, '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}', true);
select lives_ok($$insert into public.deck_games (deck_id, version_id, file_name, note, stats)
  values ('30000000-0000-0000-0000-0000000030d1', '60000000-0000-0000-0000-0000000030e1', 'game-stats-2026-10-22T14-46-08.csv', 'Kept a slow hand', '{"summary":{"result":"loss"}}')$$,
  'the owner uploads a game onto a version of the deck');
select is((select note from public.deck_games), 'Kept a slow hand', 'the note is stored');
select is((select stats->'summary'->>'result' from public.deck_games), 'loss', 'the parsed stats are stored');
select ok((select uploaded_at is not null from public.deck_games), 'the upload time is set');
select lives_ok($$insert into public.deck_games (deck_id, stats) values ('30000000-0000-0000-0000-0000000030d1', '{}')$$,
  'a game needs no version, note or file name');
select throws_ok($$insert into public.deck_games (deck_id, version_id, stats) values ('30000000-0000-0000-0000-0000000030d1', '60000000-0000-0000-0000-0000000030e9', '{}')$$,
  '23503', null, 'a game''s version must be one of its deck''s');
select lives_ok($$update public.deck_games set version_id = '60000000-0000-0000-0000-0000000030e2' where version_id is null$$,
  'the owner ties a game to a version later');
select is((select count(*)::int from public.deck_games where version_id = '60000000-0000-0000-0000-0000000030e2'), 1, 'the game moved to version 2');
select lives_ok($$update public.deck_games set version_id = null where version_id = '60000000-0000-0000-0000-0000000030e2'$$,
  'and can untie it');
select throws_ok($$update public.deck_games set version_id = '60000000-0000-0000-0000-0000000030e9'$$,
  '23503', null, 'a game cannot move onto another deck''s version');
select throws_ok($$update public.deck_games set note = 'changed'$$, '42501', null, 'the note and stats cannot be rewritten');
select throws_ok($$update public.deck_games set deck_id = '30000000-0000-0000-0000-0000000030d2'$$, '42501', null, 'a game cannot move deck');
select throws_ok($$insert into public.deck_games (deck_id, stats, uploaded_at) values ('30000000-0000-0000-0000-0000000030d1', '{}', '2020-01-01')$$,
  '42501', null, 'clients cannot set the upload time');
select throws_ok($$insert into public.deck_games (deck_id, stats) values ('30000000-0000-0000-0000-0000000030d1', '[]')$$,
  '23514', null, 'stats must be an object');
select throws_ok($$insert into public.deck_games (deck_id, note, stats) values ('30000000-0000-0000-0000-0000000030d1', repeat('x', 501), '{}')$$,
  '23514', null, 'notes are at most 500 characters');
select throws_ok($$insert into public.deck_games (deck_id, file_name, stats) values ('30000000-0000-0000-0000-0000000030d1', repeat('x', 201), '{}')$$,
  '23514', null, 'file names are at most 200 characters');
select throws_ok($$insert into public.deck_games (deck_id, stats) values ('30000000-0000-0000-0000-0000000030d1', jsonb_build_object('pad', repeat('x', 100001)))$$,
  '23514', null, 'stats are at most 100 kB');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030a2","role":"authenticated"}', true);
select is((select count(*)::int from public.deck_games), 0, 'another user cannot read results, even on a public deck');
select throws_ok($$insert into public.deck_games (deck_id, stats) values ('30000000-0000-0000-0000-0000000030d1', '{}')$$,
  '42501', null, 'another user cannot upload onto the owner''s deck');
with changed as (update public.deck_games set version_id = null returning id)
select is((select count(*)::int from changed), 0, 'another user cannot move games');

set local role anon;
select throws_ok($$select * from public.deck_games$$, '42501', null, 'anonymous visitors cannot read results');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}', true);
with gone as (delete from public.deck_games where note is null returning id)
select is((select count(*)::int from gone), 1, 'the owner can delete a game');

reset role;
delete from public.deck_versions where id = '60000000-0000-0000-0000-0000000030e1';
select is((select count(*)::int from public.deck_games), 1, 'deleting a version keeps its results');
select is((select version_id from public.deck_games), null, 'and unties them');
delete from public.decks where id = '30000000-0000-0000-0000-0000000030d1';
select is((select count(*)::int from public.deck_games), 0, 'deleting a deck deletes its results');

select * from finish();
rollback;

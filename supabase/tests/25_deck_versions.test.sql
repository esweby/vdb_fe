begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

select has_table('public', 'deck_versions', 'exports have saved versions');
select has_function('public', 'save_deck_version', array['uuid'], 'the owner can save a version of the stored deck');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000025a1', 'version-owner@test.local'),
  ('00000000-0000-0000-0000-0000000025a2', 'version-other@test.local');
insert into public.cards (id, external_id, name, type, subtypes) values
  ('10000000-0000-0000-0000-0000000025c1', 'version-action', 'Version action', 'action', '{}'),
  ('10000000-0000-0000-0000-0000000025c2', 'version-weapon', 'Version weapon', 'weapon', '{Sword}'),
  ('10000000-0000-0000-0000-0000000025c3', 'version-equipment', 'Version equipment', 'equipment', '{Head}');
insert into public.variants (id, card_id, external_id, pitch) values
  ('20000000-0000-0000-0000-0000000025f1', '10000000-0000-0000-0000-0000000025c1', 'version-red', 1),
  ('20000000-0000-0000-0000-0000000025f2', '10000000-0000-0000-0000-0000000025c2', 'version-sword', null),
  ('20000000-0000-0000-0000-0000000025f3', '10000000-0000-0000-0000-0000000025c3', 'version-head', null);
insert into public.heroes (id, external_id, name) values
  ('40000000-0000-0000-0000-0000000025e1', 'version-hero', 'Version opponent');
insert into public.decks (id, user_id, name, is_public, pitch_targets) values
  ('30000000-0000-0000-0000-0000000025d1', '00000000-0000-0000-0000-0000000025a1', 'Version deck', true, '{"1":30}'),
  ('30000000-0000-0000-0000-0000000025d2', '00000000-0000-0000-0000-0000000025a1', 'Empty deck', false, '{}');
insert into public.deck_cards (deck_id, variant_id, quantity, sideboard) values
  ('30000000-0000-0000-0000-0000000025d1', '20000000-0000-0000-0000-0000000025f1', 1, false),
  ('30000000-0000-0000-0000-0000000025d1', '20000000-0000-0000-0000-0000000025f1', 2, true),
  ('30000000-0000-0000-0000-0000000025d1', '20000000-0000-0000-0000-0000000025f2', 1, false),
  ('30000000-0000-0000-0000-0000000025d1', '20000000-0000-0000-0000-0000000025f3', 1, true);
insert into public.deck_loadouts (id, deck_id, name, opponent_hero_id) values
  ('50000000-0000-0000-0000-0000000025b1', '30000000-0000-0000-0000-0000000025d1', 'Against opponent', '40000000-0000-0000-0000-0000000025e1');
insert into public.loadout_cards (loadout_id, variant_id, quantity) values
  ('50000000-0000-0000-0000-0000000025b1', '20000000-0000-0000-0000-0000000025f1', 3);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000025a1","role":"authenticated"}', true);
select lives_ok($$select public.save_deck_version('30000000-0000-0000-0000-0000000025d1')$$, 'the owner saves a version');
select is((select number from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000025d1'), 1, 'numbering starts at one');
select is((select snapshot->>'name' from public.deck_versions where number = 1), 'Version deck', 'the deck name is saved');
select is((select snapshot->>'hero' from public.deck_versions where number = 1), 'Viserai, the Forsaken', 'the exported hero is saved');
select is((select snapshot->>'format' from public.deck_versions where number = 1), 'Classic Constructed', 'the format is saved');
select is((select snapshot->'pitchTargets' from public.deck_versions where number = 1), '{"1":30}'::jsonb, 'pitch targets are saved');
select is((select jsonb_array_length(snapshot->'cards') from public.deck_versions where number = 1), 4, 'split rows, weapon and equipment are saved');
select ok((select snapshot->'cards' @> '[{"variantId":"20000000-0000-0000-0000-0000000025f1","quantity":1,"sideboard":false,"name":"Version action","pitch":1,"externalId":"version-red","type":"action"},{"variantId":"20000000-0000-0000-0000-0000000025f1","quantity":2,"sideboard":true}]' from public.deck_versions where number = 1), 'both sides of a split keep quantities and card identity');
select ok((select snapshot->'cards' @> '[{"type":"weapon","subtypes":["Sword"],"pitch":null},{"type":"equipment","subtypes":["Head"],"sideboard":true}]' from public.deck_versions where number = 1), 'weapons and equipment keep type, slot and pitch');
select is((select jsonb_array_length(snapshot->'loadouts') from public.deck_versions where number = 1), 2, 'default and matchup loadouts are saved');
select ok((select snapshot->'loadouts' @> '[{"name":"Against opponent","opponentHeroId":"40000000-0000-0000-0000-0000000025e1","opponentHeroName":"Version opponent","cards":[{"variantId":"20000000-0000-0000-0000-0000000025f1","quantity":3}]}]' from public.deck_versions where number = 1), 'matchup cards and opposing hero are saved');
select ok((select snapshot->'loadouts' @> '[{"isDefault":true,"opponentHeroId":null,"cards":[{"variantId":"20000000-0000-0000-0000-0000000025f1","quantity":1},{"variantId":"20000000-0000-0000-0000-0000000025f2","quantity":1}]}]' from public.deck_versions where number = 1), 'the default loadout keeps the main deck');
select lives_ok($$select public.save_deck_version('30000000-0000-0000-0000-0000000025d1')$$, 'a repeat export saves another version');
select is((select max(number) from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000025d1'), 2, 'repeat exports get the next number');
select lives_ok($$select public.save_deck_version('30000000-0000-0000-0000-0000000025d2')$$, 'an empty deck can be exported');
select is((select snapshot->'cards' from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000025d2'), '[]'::jsonb, 'an empty pool is an array');
select is((select number from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000025d2'), 1, 'each deck has its own numbering');

update public.decks set name = 'Changed deck' where id = '30000000-0000-0000-0000-0000000025d1';
delete from public.deck_cards where deck_id = '30000000-0000-0000-0000-0000000025d1';
delete from public.deck_loadouts where id = '50000000-0000-0000-0000-0000000025b1';
reset role;
update public.cards set name = 'Changed card' where id = '10000000-0000-0000-0000-0000000025c1';
set local role authenticated;
select is((select snapshot->>'name' from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000025d1' and number = 1), 'Version deck', 'renaming the deck leaves the snapshot intact');
select ok((select snapshot->'cards' @> '[{"name":"Version action","quantity":1}]' and jsonb_array_length(snapshot->'cards') = 4 and jsonb_array_length(snapshot->'loadouts') = 2 from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000025d1' and number = 1), 'editing cards, reference data and loadouts leaves the snapshot intact');
select lives_ok($$update public.deck_versions set fabrary_url = 'https://fabrary.net/decks/example123' where number = 1$$, 'the owner can paste a FaBrary deck link');
select throws_ok($$update public.deck_versions set fabrary_url = 'https://evil.example/decks/123'$$, '23514', null, 'other sites are rejected');
select throws_ok($$update public.deck_versions set snapshot = '{}'$$, '42501', null, 'saved lists cannot be rewritten');
select throws_ok($$update public.deck_versions set number = 99$$, '42501', null, 'version numbers cannot be rewritten');
select throws_ok($$insert into public.deck_versions (deck_id, number, snapshot) values ('30000000-0000-0000-0000-0000000025d1', 99, '{}')$$, '42501', null, 'clients cannot supply snapshots');
select throws_ok($$delete from public.deck_versions$$, '42501', null, 'individual versions cannot be deleted');
select lives_ok($$update public.deck_versions set fabrary_url = null$$, 'the link can be cleared');
select throws_ok($$select public.save_deck_version('30000000-0000-0000-0000-0000000025d9')$$, '42501', null, 'a missing deck cannot be exported');
reset role;
select throws_ok($$insert into public.deck_versions (deck_id, number, snapshot) values ('30000000-0000-0000-0000-0000000025d1', 0, '{}')$$, '23514', null, 'numbers must be positive');
select throws_ok($$insert into public.deck_versions (deck_id, number, snapshot) values ('30000000-0000-0000-0000-0000000025d1', 1, '{}')$$, '23505', null, 'numbers are unique within each deck');
set local role authenticated;
select throws_ok($$update public.deck_versions set fabrary_url = 'javascript:alert(1)'$$, '23514', null, 'executable links are rejected');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.save_deck_version('30000000-0000-0000-0000-0000000025d1')$$, '42501', null, 'the function requires an authenticated owner identity');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000025a2","role":"authenticated"}', true);
select is((select count(*)::int from public.deck_versions), 0, 'another user cannot read versions, even on a public deck');
select throws_ok($$select public.save_deck_version('30000000-0000-0000-0000-0000000025d1')$$, '42501', null, 'another user cannot export into the owner history');
with changed as (update public.deck_versions set fabrary_url = 'https://fabrary.net/decks/other' returning id)
select is((select count(*)::int from changed), 0, 'another user cannot change links');
set local role anon;
select throws_ok($$select * from public.deck_versions$$, '42501', null, 'anonymous visitors cannot read versions');
select throws_ok($$select public.save_deck_version('30000000-0000-0000-0000-0000000025d1')$$, '42501', null, 'anonymous visitors cannot save versions');
reset role;
delete from public.decks where id = '30000000-0000-0000-0000-0000000025d1';
select is((select count(*)::int from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000025d1'), 0, 'deleting a deck deletes its versions');
delete from auth.users where id = '00000000-0000-0000-0000-0000000025a1';
select is((select count(*)::int from public.deck_versions), 0, 'deleting the account deletes remaining versions');

select * from finish();
rollback;

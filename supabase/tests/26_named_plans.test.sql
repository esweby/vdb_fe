begin;
create extension if not exists pgtap with schema extensions;
select plan(26);
select has_function('public', 'save_matchup', array['uuid', 'text', 'uuid', 'jsonb', 'uuid'], 'named sideboard plans save atomically');
select ok(has_function_privilege('authenticated', 'public.save_matchup(uuid,text,uuid,jsonb,uuid)', 'EXECUTE'), 'signed-in users can call the save function');
select ok(not has_function_privilege('anon', 'public.save_matchup(uuid,text,uuid,jsonb,uuid)', 'EXECUTE'), 'anonymous users cannot call the save function');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000026a1', 'plan-owner@test.local'),
  ('00000000-0000-0000-0000-0000000026a2', 'plan-other@test.local');
insert into public.decks (id, user_id, name, is_public) values
  ('30000000-0000-0000-0000-0000000026d1', '00000000-0000-0000-0000-0000000026a1', 'Plans deck', true),
  ('30000000-0000-0000-0000-0000000026d2', '00000000-0000-0000-0000-0000000026a1', 'Another deck', false);
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000026c1', 'named-plan-card', 'Plan card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('20000000-0000-0000-0000-0000000026f1', '10000000-0000-0000-0000-0000000026c1', 'named-plan-red', 1);
insert into public.deck_cards (deck_id, variant_id, quantity) values
  ('30000000-0000-0000-0000-0000000026d1', '20000000-0000-0000-0000-0000000026f1', 3);
insert into public.heroes (id, external_id, name) values
  ('40000000-0000-0000-0000-0000000026e1', 'named-plan-hero', 'Plan hero');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000026a1","role":"authenticated"}', true);
select lives_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', '  More defence  ', null, '[{"variantId":"20000000-0000-0000-0000-0000000026f1","quantity":2}]')$$, 'a custom named plan needs no hero');
select set_config('vdb_test.plan_id', (select id::text from public.deck_loadouts where deck_id = '30000000-0000-0000-0000-0000000026d1' and name = 'More defence'), true);
select is((select name from public.deck_loadouts where id = current_setting('vdb_test.plan_id')::uuid), 'More defence', 'the name is trimmed');
select is((select quantity::int from public.loadout_cards where loadout_id = current_setting('vdb_test.plan_id')::uuid), 2, 'the plan saves its cards');
select lives_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'Race', null, '[]')$$, 'another generic plan can coexist');
select is((select count(*)::int from public.deck_loadouts where deck_id = '30000000-0000-0000-0000-0000000026d1' and not is_default and opponent_hero_id is null), 2, 'generic plans are separate rows');
select lives_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'vs Plan hero', '40000000-0000-0000-0000-0000000026e1', '[]')$$, 'hero-specific plans still work');
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'Duplicate hero', '40000000-0000-0000-0000-0000000026e1', '[]')$$, '23505', null, 'one plan per hero is preserved');
select lives_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'More defence', null, '[{"variantId":"20000000-0000-0000-0000-0000000026f1","quantity":1}]', current_setting('vdb_test.plan_id')::uuid)$$, 'a saved plan is updated by id');
select is((select quantity::int from public.loadout_cards where loadout_id = current_setting('vdb_test.plan_id')::uuid), 1, 'updating replaces its list');
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'Broken change', null, '[{"variantId":"20000000-0000-0000-0000-0000000026f1","quantity":4}]', current_setting('vdb_test.plan_id')::uuid)$$, '23514', null, 'a plan cannot exceed the card pool');
select is((select name from public.deck_loadouts where id = current_setting('vdb_test.plan_id')::uuid), 'More defence', 'failed saves leave the old name intact');
select is((select quantity::int from public.loadout_cards where loadout_id = current_setting('vdb_test.plan_id')::uuid), 1, 'failed saves leave the old cards intact');
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', '   ', null, '[]')$$, '23514', null, 'blank names are rejected');
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', repeat('x', 81), null, '[]')$$, '23514', null, 'long names are rejected');
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'Missing cards', null, null)$$, '23514', null, 'the card array is required');
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'Replace main', null, '[]', (select id from public.deck_loadouts where deck_id = '30000000-0000-0000-0000-0000000026d1' and is_default))$$, '42501', null, 'the default loadout cannot be overwritten');
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d2', 'Move plan', null, '[]', current_setting('vdb_test.plan_id')::uuid)$$, '42501', null, 'plans cannot move between decks');
select lives_ok($$select public.save_deck_version('30000000-0000-0000-0000-0000000026d1')$$, 'versions still capture the saved plans');
select ok((select snapshot->'loadouts' @> '[{"name":"More defence","opponentHeroId":null,"cards":[{"variantId":"20000000-0000-0000-0000-0000000026f1","quantity":1}]}]' from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000026d1'), 'a generic plan is included in the version');
delete from public.deck_loadouts where id = current_setting('vdb_test.plan_id')::uuid;
select ok((select snapshot->'loadouts' @> '[{"name":"More defence"}]' from public.deck_versions where deck_id = '30000000-0000-0000-0000-0000000026d1'), 'deleting a live plan leaves the version intact');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000026a2","role":"authenticated"}', true);
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'Other user', null, '[]')$$, '42501', null, 'another user cannot save plans on a public deck');
select is((select count(*)::int from public.deck_loadouts where deck_id = '30000000-0000-0000-0000-0000000026d1'), 0, 'another user cannot read its plans');
set local role anon;
select throws_ok($$select public.save_matchup('30000000-0000-0000-0000-0000000026d1', 'Visitor', null, '[]')$$, '42501', null, 'anonymous visitors cannot save plans');
select * from finish();
rollback;

-- Deck list import (the maintainer, 27 Oct 2026): replacing a pool replaces the deck and the
-- sideboard together, in one statement, so a failed import leaves the old pool intact.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
select has_function('public', 'replace_deck_cards', array['uuid', 'jsonb'], 'a pool can be replaced in one call');
select ok(has_function_privilege('authenticated', 'public.replace_deck_cards(uuid,jsonb)', 'EXECUTE'), 'signed-in users can call it');
select ok(not has_function_privilege('anon', 'public.replace_deck_cards(uuid,jsonb)', 'EXECUTE'), 'anonymous users cannot call it');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000028a1', 'import-owner@test.local'),
  ('00000000-0000-0000-0000-0000000028a2', 'import-other@test.local');
insert into public.decks (id, user_id, name, visibility) values
  ('30000000-0000-0000-0000-0000000028d1', '00000000-0000-0000-0000-0000000028a1', 'Import deck', 'public');
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000028c1', 'import-card', 'Import card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('20000000-0000-0000-0000-0000000028f1', '10000000-0000-0000-0000-0000000028c1', 'import-red', 1),
  ('20000000-0000-0000-0000-0000000028f2', '10000000-0000-0000-0000-0000000028c1', 'import-blue', 3);
insert into public.deck_cards (deck_id, variant_id, quantity, sideboard) values
  ('30000000-0000-0000-0000-0000000028d1', '20000000-0000-0000-0000-0000000028f1', 3, false),
  ('30000000-0000-0000-0000-0000000028d1', '20000000-0000-0000-0000-0000000028f1', 1, true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000028a1","role":"authenticated"}', true);
select public.save_matchup('30000000-0000-0000-0000-0000000028d1', 'Plan', null, '[{"variantId":"20000000-0000-0000-0000-0000000028f1","quantity":4}]');

select lives_ok($$select public.replace_deck_cards('30000000-0000-0000-0000-0000000028d1',
  '[{"variantId":"20000000-0000-0000-0000-0000000028f2","quantity":2,"sideboard":false},
    {"variantId":"20000000-0000-0000-0000-0000000028f2","quantity":1,"sideboard":true}]')$$,
  'the owner replaces the pool');
select results_eq(
  $$select variant_id, quantity::int, sideboard from public.deck_cards
     where deck_id = '30000000-0000-0000-0000-0000000028d1' order by sideboard$$,
  $$values ('20000000-0000-0000-0000-0000000028f2'::uuid, 2, false), ('20000000-0000-0000-0000-0000000028f2'::uuid, 1, true)$$,
  'the deck and the sideboard are both replaced');
select results_eq(
  $$select lc.variant_id, lc.quantity::int from public.loadout_cards lc
      join public.deck_loadouts dl on dl.id = lc.loadout_id
     where dl.deck_id = '30000000-0000-0000-0000-0000000028d1' and dl.is_default$$,
  $$values ('20000000-0000-0000-0000-0000000028f2'::uuid, 2)$$,
  'the main deck follows the new deck rows');
select is((select count(*)::int from public.loadout_cards lc
             join public.deck_loadouts dl on dl.id = lc.loadout_id
            where dl.deck_id = '30000000-0000-0000-0000-0000000028d1' and not dl.is_default), 0,
  'plans lose cards that left the pool');
select throws_ok($$select public.replace_deck_cards('30000000-0000-0000-0000-0000000028d1',
  '[{"variantId":"20000000-0000-0000-0000-0000000028f1","quantity":2,"sideboard":false},
    {"variantId":"20000000-0000-0000-0000-0000000028f1","quantity":0,"sideboard":true}]')$$,
  '23514', null, 'a bad row fails the whole import');
select is((select sum(quantity)::int from public.deck_cards where deck_id = '30000000-0000-0000-0000-0000000028d1'), 3,
  'a failed import leaves the old pool');
select throws_ok($$select public.replace_deck_cards('30000000-0000-0000-0000-0000000028d1',
  '[{"variantId":"20000000-0000-0000-0000-0000000028ff","quantity":1,"sideboard":false}]')$$,
  '23503', null, 'an unknown card fails the import');
select throws_ok($$select public.replace_deck_cards('30000000-0000-0000-0000-0000000028d1',
  '[{"variantId":"20000000-0000-0000-0000-0000000028f1","quantity":1,"sideboard":false},
    {"variantId":"20000000-0000-0000-0000-0000000028f1","quantity":1,"sideboard":false}]')$$,
  '23505', null, 'the same card twice on one side fails the import');
select throws_ok($$select public.replace_deck_cards('30000000-0000-0000-0000-0000000028d1', null)$$,
  '23514', null, 'the card array is required');
select lives_ok($$select public.replace_deck_cards('30000000-0000-0000-0000-0000000028d1', '[]')$$,
  'an empty list empties the pool');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000028a2","role":"authenticated"}', true);
select throws_ok($$select public.replace_deck_cards('30000000-0000-0000-0000-0000000028d1', '[]')$$,
  '42501', null, 'another user cannot replace a public deck''s pool');
set local role anon;
select throws_ok($$select public.replace_deck_cards('30000000-0000-0000-0000-0000000028d1', '[]')$$,
  '42501', null, 'anonymous visitors cannot replace a pool');
select * from finish();
rollback;

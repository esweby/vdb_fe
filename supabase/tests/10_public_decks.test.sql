-- Decks are private by default. Anyone (signed in or not) can read a public deck and its cards;
-- only the owner can change a deck, public or not.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select col_default_is('public', 'decks', 'is_public', 'false', 'decks are private by default');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000006a2', 'other@test.local');
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000006c1', 'ext-public-deck-card', 'Public Deck Card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('20000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c1', 'ext-public-deck-v', 1);
insert into public.decks (id, user_id, name, is_public) values
  ('30000000-0000-0000-0000-0000000006d1', '00000000-0000-0000-0000-0000000006a1', 'Shared', true),
  ('30000000-0000-0000-0000-0000000006d2', '00000000-0000-0000-0000-0000000006a1', 'Secret', false);
insert into public.deck_cards (deck_id, variant_id, quantity) values
  ('30000000-0000-0000-0000-0000000006d1', '20000000-0000-0000-0000-0000000006c1', 3),
  ('30000000-0000-0000-0000-0000000006d2', '20000000-0000-0000-0000-0000000006c1', 2);

set local role anon;
select results_eq(
  $$select name from public.decks where id in ('30000000-0000-0000-0000-0000000006d1', '30000000-0000-0000-0000-0000000006d2') order by name$$,
  $$values ('Shared'::text)$$,
  'signed-out visitors see public decks only'
);
select is(
  (select count(*)::int from public.deck_cards where deck_id in ('30000000-0000-0000-0000-0000000006d1', '30000000-0000-0000-0000-0000000006d2')), 1,
  'and only the cards of public decks'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select results_eq(
  $$select name from public.decks where id in ('30000000-0000-0000-0000-0000000006d1', '30000000-0000-0000-0000-0000000006d2') order by name$$,
  $$values ('Shared'::text)$$,
  'another user sees the public deck, not the private one'
);
update public.decks set name = 'Hijacked' where id = '30000000-0000-0000-0000-0000000006d1';
select is(
  (select name from public.decks where id = '30000000-0000-0000-0000-0000000006d1'), 'Shared',
  'and cannot rename it'
);
select throws_ok(
  $$insert into public.deck_cards (deck_id, variant_id, quantity)
    values ('30000000-0000-0000-0000-0000000006d1', '20000000-0000-0000-0000-0000000006c1', 1)
    on conflict (deck_id, variant_id, sideboard) do update set quantity = 1$$,
  '42501', null, 'or change its cards'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.decks where id in ('30000000-0000-0000-0000-0000000006d1', '30000000-0000-0000-0000-0000000006d2')), 2,
  'the owner sees both of their decks'
);
select lives_ok(
  $$update public.decks set is_public = true where id = '30000000-0000-0000-0000-0000000006d2'$$,
  'and can make one public'
);
select is(
  (select is_public from public.decks where id = '30000000-0000-0000-0000-0000000006d2'), true,
  'which is saved'
);
reset role;

set local role anon;
select is(
  (select count(*)::int from public.decks where id in ('30000000-0000-0000-0000-0000000006d1', '30000000-0000-0000-0000-0000000006d2')), 2,
  'and signed-out visitors can now see it'
);
reset role;

select * from finish();
rollback;

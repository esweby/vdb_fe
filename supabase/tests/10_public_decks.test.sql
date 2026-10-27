-- Decks are private by default. A public deck is listed: anyone (signed in or not) can read it and
-- its cards. A link-only deck isn't listed, so no one else can read it from the tables; anyone
-- who has its link reads it through public.linked_deck(id). Only the owner can change a deck.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

select col_default_is('public', 'decks', 'visibility', 'private'::text, 'decks are private by default');
select hasnt_column('public', 'decks', 'is_public', 'the old public flag is gone');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000006a2', 'other@test.local');
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000006c1', 'ext-public-deck-card', 'Public Deck Card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('20000000-0000-0000-0000-0000000006c1', '10000000-0000-0000-0000-0000000006c1', 'ext-public-deck-v', 1);
insert into public.decks (id, user_id, name, visibility, pitch_targets) values
  ('30000000-0000-0000-0000-0000000006d1', '00000000-0000-0000-0000-0000000006a1', 'Shared', 'public', '{}'),
  ('30000000-0000-0000-0000-0000000006d2', '00000000-0000-0000-0000-0000000006a1', 'Secret', 'private', '{}'),
  ('30000000-0000-0000-0000-0000000006d3', '00000000-0000-0000-0000-0000000006a1', 'Linked', 'link', '{"3":22}');
insert into public.deck_cards (deck_id, variant_id, quantity, sideboard) values
  ('30000000-0000-0000-0000-0000000006d1', '20000000-0000-0000-0000-0000000006c1', 3, false),
  ('30000000-0000-0000-0000-0000000006d2', '20000000-0000-0000-0000-0000000006c1', 2, false),
  ('30000000-0000-0000-0000-0000000006d3', '20000000-0000-0000-0000-0000000006c1', 1, true);

select throws_ok(
  $$update public.decks set visibility = 'hidden' where id = '30000000-0000-0000-0000-0000000006d2'$$,
  '23514', null, 'visibility is private, link or public'
);
select ok(
  has_function_privilege('anon', 'public.linked_deck(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.linked_deck(uuid)', 'EXECUTE'),
  'anyone can open a deck link'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.linked_deck(uuid)'::regprocedure),
  'it reads past row level security with a fixed, empty search path'
);

set local role anon;
select results_eq(
  $$select name from public.decks where id::text like '30000000-0000-0000-0000-0000000006d%' order by name$$,
  $$values ('Shared'::text)$$,
  'signed-out visitors can list public decks only, not link-only ones'
);
select is(
  (select count(*)::int from public.deck_cards where deck_id::text like '30000000-0000-0000-0000-0000000006d%'), 1,
  'and only the cards of public decks'
);
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006d3') ->> 'name', 'Linked',
  'but with the link they can open a link-only deck'
);
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006d3') -> 'cards',
  '[{"variantId": "20000000-0000-0000-0000-0000000006c1", "quantity": 1, "sideboard": true}]'::jsonb,
  'with its cards'
);
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006d3') -> 'pitchTargets', '{"3": 22}'::jsonb,
  'and pitch targets'
);
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006d3') ->> 'ownerId', '00000000-0000-0000-0000-0000000006a1',
  'and owner'
);
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006d1') ->> 'name', 'Shared',
  'a public deck opens from its link too'
);
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006d2'), null,
  'a private deck doesn''t, even with its link'
);
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006ff'), null,
  'nor does a deck that doesn''t exist'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select results_eq(
  $$select name from public.decks where id::text like '30000000-0000-0000-0000-0000000006d%' order by name$$,
  $$values ('Shared'::text)$$,
  'another user sees only the public deck in the tables'
);
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006d3') ->> 'name', 'Linked',
  'and opens the link-only one from its link'
);
update public.decks set name = 'Hijacked' where id in ('30000000-0000-0000-0000-0000000006d1', '30000000-0000-0000-0000-0000000006d3');
select is(
  (select name from public.decks where id = '30000000-0000-0000-0000-0000000006d1'), 'Shared',
  'but cannot rename a deck'
);
select throws_ok(
  $$insert into public.deck_cards (deck_id, variant_id, quantity)
    values ('30000000-0000-0000-0000-0000000006d1', '20000000-0000-0000-0000-0000000006c1', 1)
    on conflict (deck_id, variant_id, sideboard) do update set quantity = 1$$,
  '42501', null, 'or change its cards'
);
reset role;
select is(
  (select name from public.decks where id = '30000000-0000-0000-0000-0000000006d3'), 'Linked',
  'the link-only deck kept its name too'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.decks where id::text like '30000000-0000-0000-0000-0000000006d%'), 3,
  'the owner sees all of their decks'
);
select lives_ok(
  $$update public.decks set visibility = 'link' where id = '30000000-0000-0000-0000-0000000006d2'$$,
  'and can make one link-only'
);
select is(
  (select visibility from public.decks where id = '30000000-0000-0000-0000-0000000006d2'), 'link',
  'which is saved'
);
reset role;

set local role anon;
select is(
  public.linked_deck('30000000-0000-0000-0000-0000000006d2') ->> 'name', 'Secret',
  'and its link now opens for signed-out visitors'
);
reset role;

select * from finish();
rollback;

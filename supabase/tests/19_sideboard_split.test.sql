-- A card split between the deck and the sideboard (the maintainer, 20 Oct 2026: "1 of in deck
-- and 2 of in sideboard"). A card has up to two pool rows, one for the deck and one for the
-- sideboard. The default loadout is the deck row; every loadout stays within both rows together.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000019a1', 'split@test.local');
insert into public.heroes (id, external_id, name, classes, talents) values
  ('40000000-0000-0000-0000-0000000019e1', 'ext-split-hero', 'Split Hero', '{Warrior}', '{}');
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000019c1', 'ext-split-1', 'Split Card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('20000000-0000-0000-0000-0000000019f1', '10000000-0000-0000-0000-0000000019c1', 'ext-split-1-r', 1);
insert into public.decks (id, user_id, name) values
  ('30000000-0000-0000-0000-0000000019d1', '00000000-0000-0000-0000-0000000019a1', 'Split deck');
insert into public.deck_loadouts (id, deck_id, name, opponent_hero_id) values
  ('50000000-0000-0000-0000-0000000019b1', '30000000-0000-0000-0000-0000000019d1',
   'vs Split Hero', '40000000-0000-0000-0000-0000000019e1');

create function pg_temp.loadout_quantity(is_default boolean) returns int language sql as $$
  select coalesce((
    select lc.quantity::int from public.loadout_cards lc
      join public.deck_loadouts dl on dl.id = lc.loadout_id
     where dl.deck_id = '30000000-0000-0000-0000-0000000019d1' and dl.is_default = $1
       and lc.variant_id = '20000000-0000-0000-0000-0000000019f1'), 0)
$$;

select lives_ok(
  $$insert into public.deck_cards (deck_id, variant_id, quantity, sideboard) values
    ('30000000-0000-0000-0000-0000000019d1', '20000000-0000-0000-0000-0000000019f1', 1, false),
    ('30000000-0000-0000-0000-0000000019d1', '20000000-0000-0000-0000-0000000019f1', 2, true)$$,
  'a card can have 1 copy in the deck and 2 in the sideboard'
);
select is(pg_temp.loadout_quantity(true), 1, 'the default loadout has the deck copy only');

select lives_ok(
  $$insert into public.loadout_cards (loadout_id, variant_id, quantity)
    values ('50000000-0000-0000-0000-0000000019b1', '20000000-0000-0000-0000-0000000019f1', 3)$$,
  'a matchup can board in every copy, from the deck and the sideboard'
);
select throws_ok(
  $$update public.loadout_cards set quantity = 4
     where loadout_id = '50000000-0000-0000-0000-0000000019b1'$$,
  '23514', null, 'but no more than both together'
);

update public.deck_cards set quantity = 1
 where deck_id = '30000000-0000-0000-0000-0000000019d1' and sideboard;
select is(pg_temp.loadout_quantity(false), 2, 'fewer sideboard copies clamp a matchup to the copies left');
select is(pg_temp.loadout_quantity(true), 1, 'and leave the default loadout alone');

update public.deck_cards set quantity = 2
 where deck_id = '30000000-0000-0000-0000-0000000019d1' and not sideboard;
select is(pg_temp.loadout_quantity(true), 2, 'more deck copies go into the default loadout');

delete from public.deck_cards
 where deck_id = '30000000-0000-0000-0000-0000000019d1' and not sideboard;
select is(pg_temp.loadout_quantity(true), 0, 'without a deck row the card leaves the default loadout');
select is(pg_temp.loadout_quantity(false), 1, 'and a matchup keeps the sideboard copies');

select * from finish();
rollback;

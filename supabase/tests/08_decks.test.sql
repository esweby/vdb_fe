-- Deck editing (README "Weapons and equipment"): the sideboard flag drives the default loadout,
-- and format rules are configuration.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'd@test.local');
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000000d1', 'ext-deck-card-1', 'Deck Card One', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d1', 'ext-deck-v-1', 1);
insert into public.decks (id, user_id, name)
  values ('30000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000d', 'Deck');
insert into public.deck_cards (deck_id, variant_id, quantity)
  values ('30000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000d1', 2);

create function pg_temp.default_loadout_quantity() returns int language sql as $$
  select coalesce((
    select lc.quantity::int from public.loadout_cards lc
      join public.deck_loadouts dl on dl.id = lc.loadout_id
     where dl.deck_id = '30000000-0000-0000-0000-0000000000d1' and dl.is_default
       and lc.variant_id = '20000000-0000-0000-0000-0000000000d1'), 0)
$$;

select is(pg_temp.default_loadout_quantity(), 2, 'a main deck card starts in the default loadout');

update public.deck_cards set sideboard = true
 where deck_id = '30000000-0000-0000-0000-0000000000d1';
select is(pg_temp.default_loadout_quantity(), 0, 'moving a card to the sideboard takes it out of the default loadout');

update public.deck_cards set sideboard = false
 where deck_id = '30000000-0000-0000-0000-0000000000d1';
select is(pg_temp.default_loadout_quantity(), 2, 'moving a card back from the sideboard puts every copy back in the default loadout');

update public.deck_cards set quantity = 3
 where deck_id = '30000000-0000-0000-0000-0000000000d1';
select is(pg_temp.default_loadout_quantity(), 3, 'adding copies of a main deck card adds them to the default loadout');

update public.deck_cards set quantity = 1
 where deck_id = '30000000-0000-0000-0000-0000000000d1';
select is(pg_temp.default_loadout_quantity(), 1, 'removing copies takes them out of the default loadout');

select ok(
  (select value ? 'copyLimit' and value ? 'deckMin' and value ? 'poolMax' and value ? 'weaponHands'
     from public.app_settings where key = 'format_classic_constructed'),
  'Classic Constructed format rules are configuration'
);

set local role anon;
select is(
  (select count(*)::int from public.app_settings where key = 'format_classic_constructed'),
  1, 'anyone can read the format rules'
);
reset role;

select * from finish();
rollback;

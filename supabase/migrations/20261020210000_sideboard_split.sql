-- A card split between the deck and the sideboard (the maintainer, 20 Oct 2026: "1 of in deck
-- and 2 of in sideboard"). The sideboard flag joins the key, so a card has up to two pool rows:
-- its deck copies and its sideboard copies. Its pool is both rows together.
--
-- The default loadout is the main deck: the deck row's copies, nothing from the sideboard. Every
-- other loadout (matchup plans) stays within the pool, and is clamped when the pool shrinks.
-- One trigger keeps both in step, replacing the four that assumed one row per card.

alter table public.deck_cards drop constraint deck_cards_pkey;
alter table public.deck_cards add primary key (deck_id, variant_id, sideboard);

drop trigger deck_cards_add_to_default_loadout on public.deck_cards;
drop trigger deck_cards_clamp_loadouts on public.deck_cards;
drop trigger deck_cards_remove_from_loadouts on public.deck_cards;
drop trigger deck_cards_sync_default_loadout on public.deck_cards;
drop function public.add_pool_card_to_default_loadout();
drop function public.clamp_loadouts_to_pool();
drop function public.remove_pool_card_from_loadouts();
drop function public.sync_default_loadout();

create function public.sync_loadouts_to_pool()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  card_deck uuid := coalesce(new.deck_id, old.deck_id);
  card_variant uuid := coalesce(new.variant_id, old.variant_id);
  pool smallint;
  main smallint;
begin
  select coalesce(sum(quantity), 0), sum(quantity) filter (where not sideboard)
    into pool, main
    from public.deck_cards
   where deck_id = card_deck and variant_id = card_variant;

  -- Matchup plans: within the pool, or gone with it.
  if pool = 0 then
    delete from public.loadout_cards lc
     using public.deck_loadouts dl
     where dl.id = lc.loadout_id and dl.deck_id = card_deck
       and lc.variant_id = card_variant and not dl.is_default;
  else
    update public.loadout_cards lc
       set quantity = pool
      from public.deck_loadouts dl
     where dl.id = lc.loadout_id and dl.deck_id = card_deck
       and lc.variant_id = card_variant and not dl.is_default
       and lc.quantity > pool;
  end if;

  -- The default loadout: exactly the deck copies.
  if main is null then
    delete from public.loadout_cards lc
     using public.deck_loadouts dl
     where dl.id = lc.loadout_id and dl.deck_id = card_deck
       and lc.variant_id = card_variant and dl.is_default;
  else
    insert into public.loadout_cards (loadout_id, variant_id, quantity)
    select id, card_variant, main
      from public.deck_loadouts
     where deck_id = card_deck and is_default
    on conflict (loadout_id, variant_id) do update set quantity = excluded.quantity;
  end if;
  return null;
end;
$$;

create trigger deck_cards_sync_loadouts
  after insert or update or delete on public.deck_cards
  for each row execute function public.sync_loadouts_to_pool();

-- A loadout can't hold a card the pool doesn't have, or more copies than both rows together.
-- The default loadout counts the deck row only: it never holds sideboard copies.
create or replace function public.check_loadout_within_pool()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pool_quantity integer;
begin
  select sum(dc.quantity) into pool_quantity
    from public.deck_loadouts dl
    join public.deck_cards dc on dc.deck_id = dl.deck_id and dc.variant_id = new.variant_id
   where dl.id = new.loadout_id and not (dl.is_default and dc.sideboard);

  if pool_quantity is null or new.quantity > pool_quantity then
    raise exception 'loadout quantity % exceeds pool quantity % for variant %',
      new.quantity, coalesce(pool_quantity, 0), new.variant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

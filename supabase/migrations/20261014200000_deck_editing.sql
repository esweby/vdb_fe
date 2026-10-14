-- Deck editing (phase one M7).

-- In phase one the default loadout is the main deck: every card in the pool that isn't
-- in the sideboard, with every copy. Other loadouts only clamp (see clamp_loadouts_to_pool).
create function public.sync_default_loadout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sideboard then
    delete from public.loadout_cards lc
     using public.deck_loadouts dl
     where dl.id = lc.loadout_id
       and dl.deck_id = new.deck_id
       and dl.is_default
       and lc.variant_id = new.variant_id;
  else
    insert into public.loadout_cards (loadout_id, variant_id, quantity)
    select id, new.variant_id, new.quantity
      from public.deck_loadouts
     where deck_id = new.deck_id and is_default
    on conflict (loadout_id, variant_id) do update set quantity = excluded.quantity;
  end if;
  return new;
end;
$$;

create trigger deck_cards_sync_default_loadout
  after update of quantity, sideboard on public.deck_cards
  for each row execute function public.sync_default_loadout();

-- UNVERIFIED: drafted from memory, to be checked by an experienced player.
insert into public.app_settings (key, value, description) values
  ('format_classic_constructed',
   '{"copyLimit": 3, "deckMin": 60, "poolMax": 80, "weaponHands": 2}',
   'UNVERIFIED Classic Constructed rules: copies per card and pitch, minimum deck cards '
   '(not counting weapons, equipment or sideboard), maximum card pool including weapons, '
   'equipment and sideboard, and hands available for weapons and off-hand equipment');

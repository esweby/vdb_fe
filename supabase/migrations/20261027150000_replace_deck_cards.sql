-- Deck list import (the maintainer, 27 Oct 2026): replacing a pool replaces the deck and the
-- sideboard together. One statement, so a bad row leaves the old pool as it was. The
-- deck_cards trigger keeps the main deck loadout in step and trims plans to the new pool.
create function public.replace_deck_cards(target_deck_id uuid, new_cards jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.decks
    where id = target_deck_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Only the deck owner can replace its cards' using errcode = '42501';
  end if;
  if jsonb_typeof(new_cards) is distinct from 'array' then
    raise exception 'Deck cards must be an array' using errcode = '23514';
  end if;

  delete from public.deck_cards where deck_id = target_deck_id;
  insert into public.deck_cards (deck_id, variant_id, quantity, sideboard)
    select target_deck_id, card."variantId", card.quantity, card.sideboard
      from jsonb_to_recordset(new_cards)
        as card("variantId" uuid, quantity smallint, sideboard boolean);
  update public.decks set updated_at = now() where id = target_deck_id;
end;
$$;

revoke all on function public.replace_deck_cards(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_deck_cards(uuid, jsonb) to authenticated;

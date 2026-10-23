update public.deck_loadouts dl
  set name = left('vs ' || h.name, 80)
  from public.heroes h
  where h.id = dl.opponent_hero_id and not dl.is_default and dl.name = 'Matchup';

create function public.save_matchup(
  target_deck_id uuid,
  plan_name text,
  opponent_id uuid,
  plan_cards jsonb,
  target_loadout_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  perform 1 from public.decks
    where id = target_deck_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Only the deck owner can save a plan' using errcode = '42501';
  end if;
  if plan_name is null or char_length(btrim(plan_name)) not between 1 and 80 then
    raise exception 'A plan needs a name of 1 to 80 characters' using errcode = '23514';
  end if;
  if jsonb_typeof(plan_cards) is distinct from 'array' then
    raise exception 'Plan cards must be an array' using errcode = '23514';
  end if;

  if target_loadout_id is null then
    insert into public.deck_loadouts (deck_id, name, opponent_hero_id)
      values (target_deck_id, btrim(plan_name), opponent_id) returning id into saved_id;
  else
    update public.deck_loadouts set name = btrim(plan_name), opponent_hero_id = opponent_id
      where id = target_loadout_id and deck_id = target_deck_id and not is_default
      returning id into saved_id;
    if not found then
      raise exception 'Only a saved sideboard plan in this deck can be changed' using errcode = '42501';
    end if;
  end if;

  delete from public.loadout_cards where loadout_id = saved_id;
  insert into public.loadout_cards (loadout_id, variant_id, quantity)
    select saved_id, card."variantId", card.quantity
      from jsonb_to_recordset(plan_cards) as card("variantId" uuid, quantity smallint);
  return saved_id;
end;
$$;

revoke all on function public.save_matchup(uuid, text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_matchup(uuid, text, uuid, jsonb, uuid) to authenticated;

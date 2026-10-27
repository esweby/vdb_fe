-- Deck visibility (the maintainer, 27 Oct 2026): private, link only or public. A public deck is
-- listed and anyone can read it. A link-only deck isn't listed: the tables still return it to its
-- owner only, so it can't be listed through the API, and anyone with its address opens it through
-- public.linked_deck(id). Loadouts, plans and versions stay owner-only whatever the visibility.

alter table public.decks
  add column visibility text not null default 'private'
    check (visibility in ('private', 'link', 'public'));

update public.decks set visibility = case when is_public then 'public' else 'private' end;

drop policy "Anyone reads public decks" on public.decks;
drop policy "Anyone reads the cards of public decks" on public.deck_cards;
drop index public.decks_public_updated;
alter table public.decks drop column is_public;

create index decks_public_updated on public.decks (updated_at desc) where visibility = 'public';

create policy "Anyone reads public decks" on public.decks
  for select to anon, authenticated
  using (visibility = 'public');

create policy "Anyone reads the cards of public decks" on public.deck_cards
  for select to anon, authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.visibility = 'public'));

-- One deck by its id, with its cards, if it's link-only or public; null otherwise. Shaped like
-- the app's deck so the deck page reads it the same way as a table row.
create function public.linked_deck(target_deck_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id,
    'name', d.name,
    'updatedAt', d.updated_at,
    'visibility', d.visibility,
    'ownerId', d.user_id,
    'pitchTargets', d.pitch_targets,
    'cards', coalesce(
      (select jsonb_agg(
         jsonb_build_object('variantId', c.variant_id, 'quantity', c.quantity, 'sideboard', c.sideboard)
         order by c.variant_id, c.sideboard)
       from public.deck_cards c
       where c.deck_id = d.id),
      '[]'::jsonb)
  )
  from public.decks d
  where d.id = target_deck_id and d.visibility in ('link', 'public');
$$;

revoke execute on function public.linked_deck(uuid) from public;
grant execute on function public.linked_deck(uuid) to anon, authenticated;

-- Site totals count public decks only; a link-only deck isn't listed.
create or replace function public.admin_site_totals()
returns table (users bigint, users_last_7d bigint, decks bigint, public_decks bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.profiles p where p.role <> 'admin'),
    (select count(*) from public.profiles p where p.role <> 'admin' and p.created_at >= now() - interval '7 days'),
    (select count(*) from public.decks d join public.profiles p on p.id = d.user_id where p.role <> 'admin'),
    (select count(*) from public.decks d join public.profiles p on p.id = d.user_id where p.role <> 'admin' and d.visibility = 'public');
end;
$$;

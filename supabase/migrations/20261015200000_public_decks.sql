-- Decks can be public or private (private by default). Anyone, signed in or not, can read a
-- public deck and its cards; only the owner can change a deck. Loadouts stay owner-only.

alter table public.decks add column is_public boolean not null default false;

create index decks_public_updated on public.decks (updated_at desc) where is_public;

create policy "Anyone reads public decks" on public.decks
  for select to anon, authenticated
  using (is_public);

create policy "Anyone reads the cards of public decks" on public.deck_cards
  for select to anon, authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.is_public));

grant select on public.decks, public.deck_cards to anon;

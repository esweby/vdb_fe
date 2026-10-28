-- Results become the deck's, with a version as an optional tie (the maintainer, 28 Oct
-- 2026: "Results should be its own tab with an upload, and you can associate it with a
-- version"). Versions can be named.

alter table public.version_games rename to deck_games;
alter index public.version_games_version_id rename to deck_games_version_id;
alter table public.deck_games rename constraint version_games_pkey to deck_games_pkey;

alter table public.deck_games add column deck_id uuid references public.decks (id) on delete cascade;
update public.deck_games g set deck_id = v.deck_id from public.deck_versions v where v.id = g.version_id;
alter table public.deck_games alter column deck_id set not null;
create index deck_games_deck_id on public.deck_games (deck_id);

-- A game's version, if it has one, must be one of its deck's.
alter table public.deck_versions add constraint deck_versions_id_deck_id unique (id, deck_id);
alter table public.deck_games drop constraint version_games_version_id_fkey;
alter table public.deck_games alter column version_id drop not null;
alter table public.deck_games add constraint deck_games_version_fkey
  foreign key (version_id, deck_id) references public.deck_versions (id, deck_id)
  on delete set null (version_id);

drop policy "Owners read their games" on public.deck_games;
drop policy "Owners upload games onto their versions" on public.deck_games;
drop policy "Owners delete their games" on public.deck_games;

create policy "Owners read their results" on public.deck_games
  for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));

create policy "Owners upload results" on public.deck_games
  for insert to authenticated
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));

create policy "Owners move results between versions" on public.deck_games
  for update to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));

create policy "Owners delete results" on public.deck_games
  for delete to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));

-- Clients choose the deck, version, file name, note and stats; the id and upload time are
-- the server's. Only the version can change afterwards.
revoke all on public.deck_games from anon, authenticated;
grant select, delete on public.deck_games to authenticated;
grant insert (deck_id, version_id, file_name, note, stats) on public.deck_games to authenticated;
grant update (version_id) on public.deck_games to authenticated;
grant all on public.deck_games to service_role;

-- A version's name, set by its owner ("Levia tech"). Blank means unnamed: send null.
alter table public.deck_versions add column name text
  constraint deck_versions_name_check check (name is null or (length(name) <= 80 and btrim(name) <> ''));
grant update (name) on public.deck_versions to authenticated;

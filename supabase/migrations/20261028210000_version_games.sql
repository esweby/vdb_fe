-- Games uploaded onto a deck version (docs/test-loop.md, step 2). The browser parses the
-- Talishar stats CSV and stores the parsed stats with an optional note. Private to the
-- deck's owner, like the versions themselves.
create table public.version_games (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.deck_versions (id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  file_name text check (file_name is null or length(file_name) <= 200),
  note text check (note is null or length(note) <= 500),
  stats jsonb not null check (jsonb_typeof(stats) = 'object' and octet_length(stats::text) <= 100000)
);

create index version_games_version_id on public.version_games (version_id);

alter table public.version_games enable row level security;

create policy "Owners read their games" on public.version_games
  for select to authenticated
  using (exists (
    select 1 from public.deck_versions v join public.decks d on d.id = v.deck_id
    where v.id = version_id and d.user_id = auth.uid()
  ));

create policy "Owners upload games onto their versions" on public.version_games
  for insert to authenticated
  with check (exists (
    select 1 from public.deck_versions v join public.decks d on d.id = v.deck_id
    where v.id = version_id and d.user_id = auth.uid()
  ));

create policy "Owners delete their games" on public.version_games
  for delete to authenticated
  using (exists (
    select 1 from public.deck_versions v join public.decks d on d.id = v.deck_id
    where v.id = version_id and d.user_id = auth.uid()
  ));

-- Clients choose the version, file name, note and stats; the id and upload time are the
-- server's. An uploaded game isn't edited: delete it and upload again.
revoke all on public.version_games from anon, authenticated;
grant select, delete on public.version_games to authenticated;
grant insert (version_id, file_name, note, stats) on public.version_games to authenticated;
grant all on public.version_games to service_role;

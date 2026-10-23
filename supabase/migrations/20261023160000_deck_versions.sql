create table public.deck_versions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  number integer not null check (number > 0),
  created_at timestamptz not null default now(),
  snapshot jsonb not null,
  fabrary_url text check (
    fabrary_url is null or
    (length(fabrary_url) <= 500 and fabrary_url ~ '^https://fabrary[.]net/decks/[A-Za-z0-9_-]+/?$')
  ),
  unique (deck_id, number)
);

alter table public.deck_versions enable row level security;

create policy "Owners read their deck versions" on public.deck_versions
  for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));

create policy "Owners update their version links" on public.deck_versions
  for update to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));

revoke all on public.deck_versions from anon, authenticated;
grant select on public.deck_versions to authenticated;
grant update (fabrary_url) on public.deck_versions to authenticated;
grant all on public.deck_versions to service_role;

create function public.save_deck_version(target_deck_id uuid)
returns public.deck_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.deck_versions;
begin
  perform 1 from public.decks
    where id = target_deck_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'Only the deck owner can save a version' using errcode = '42501';
  end if;

  insert into public.deck_versions (deck_id, number, snapshot)
  select d.id,
    coalesce((select max(v.number) from public.deck_versions v where v.deck_id = d.id), 0) + 1,
    jsonb_build_object(
      'schemaVersion', 1,
      'name', d.name,
      'hero', 'Viserai, the Forsaken',
      'format', 'Classic Constructed',
      'pitchTargets', d.pitch_targets,
      'cards', coalesce((
        select jsonb_agg(jsonb_build_object(
          'variantId', v.id, 'externalId', v.external_id,
          'name', c.name, 'pitch', v.pitch, 'type', c.type, 'subtypes', c.subtypes,
          'quantity', dc.quantity, 'sideboard', dc.sideboard
        ) order by dc.variant_id, dc.sideboard)
        from public.deck_cards dc
        join public.variants v on v.id = dc.variant_id
        join public.cards c on c.id = v.card_id
        where dc.deck_id = d.id
      ), '[]'::jsonb),
      'loadouts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', dl.id, 'name', dl.name, 'isDefault', dl.is_default,
          'opponentHeroId', dl.opponent_hero_id, 'opponentHeroName', h.name,
          'cards', coalesce((
            select jsonb_agg(jsonb_build_object('variantId', lc.variant_id, 'quantity', lc.quantity)
              order by lc.variant_id)
            from public.loadout_cards lc where lc.loadout_id = dl.id
          ), '[]'::jsonb)
        ) order by dl.id)
        from public.deck_loadouts dl
        left join public.heroes h on h.id = dl.opponent_hero_id
        where dl.deck_id = d.id
      ), '[]'::jsonb)
    )
  from public.decks d where d.id = target_deck_id
  returning * into saved;
  return saved;
end;
$$;

revoke all on function public.save_deck_version(uuid) from public, anon, authenticated;
grant execute on function public.save_deck_version(uuid) to authenticated;

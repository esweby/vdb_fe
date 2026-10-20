-- Matchups (the maintainer, 19 Oct 2026): per-hero board plans. Heroes are reference data the
-- importer writes (every adult hero playable in Classic Constructed). A matchup is one of a
-- deck's loadouts tied to an opposing hero; the existing loadout triggers keep it within the
-- deck's pool, and row level security keeps it the owner's.

create table public.heroes (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  name text not null unique check (char_length(name) between 1 and 120),
  classes text[] not null default '{}',
  talents text[] not null default '{}',
  image_url text,
  /** Playable in Classic Constructed as of the last import. */
  legal boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.heroes enable row level security;
create policy "Anyone reads heroes" on public.heroes for select
  to anon, authenticated using (true);
grant select on public.heroes to anon, authenticated;
grant all on public.heroes to service_role;

alter table public.deck_loadouts
  -- Restrict: a hero with plans is never deleted (the importer marks it not legal instead).
  add column opponent_hero_id uuid references public.heroes (id) on delete restrict,
  -- The default loadout is the main deck, against nobody in particular.
  add constraint deck_loadouts_default_has_no_opponent
    check (not (is_default and opponent_hero_id is not null));

-- One plan per hero per deck.
create unique index deck_loadouts_one_per_opponent
  on public.deck_loadouts (deck_id, opponent_hero_id)
  where opponent_hero_id is not null;

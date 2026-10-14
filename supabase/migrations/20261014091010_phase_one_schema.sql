-- Phase one schema. See README "Tables" and docs/phase-one.md (M1).
-- Synergy and scenario tables arrive in phase two.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.side as enum ('forsaken', 'usurper');
create type public.app_role as enum ('user', 'scorer', 'curator', 'admin');

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'user',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Kept out of profiles so row level security can make it admin-only.
create table public.rater_weights (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rating_weight numeric not null default 1.0 check (rating_weight >= 0)
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.rater_weights (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The signed-in user's role. Security definer so policies can read it without
-- recursing through profiles' own policies.
create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text
);

insert into public.app_settings (key, value, description) values
  ('fringe_default', '20', 'Default community score for fringe cards (0-100)'),
  ('fringe_k', '3', 'How many ratings the fringe default is worth'),
  ('min_rating_count', '2', 'Minimum number of scorers before a card can appear in the ranking');

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,          -- dataset unique_id (the-fab-cube)
  name text not null,
  type text not null,                        -- action | attack_action | instant | weapon | equipment | ...
  subtypes text[] not null default '{}',     -- includes equipment slot and weapon handedness
  classes text[] not null default '{}',
  talents text[] not null default '{}',
  keywords text[] not null default '{}',
  text text,
  attributes jsonb not null default '{}'::jsonb,
  fringe boolean not null default false,
  hidden boolean not null default false,     -- for trimming irrelevant generics later
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per name + pitch. Called variants, not printings, because the
-- dataset uses "printing" for a physical print run.
create table public.variants (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  external_id text not null unique,
  pitch smallint check (pitch between 0 and 3),
  cost smallint,
  power smallint,
  defense smallint,
  unique (card_id, id)                       -- target for "variant belongs to card" foreign keys
);

create table public.score_dimensions (
  id smallint primary key generated always as identity,
  key text not null unique,
  label text not null,
  sort_order smallint not null
);

insert into public.score_dimensions (key, label, sort_order) values
  ('runechantCreation', 'Runechant creation', 1),
  ('gateCreation', 'Gate creation', 2),
  ('banish', 'Banish (from hand or deck)', 3),
  ('playableFromBanish', 'Playable from banish', 4),
  ('enablesTraverse', 'Enables traverse', 5),
  ('utility', 'Utility', 6);

-- ---------------------------------------------------------------------------
-- Scoring
-- ---------------------------------------------------------------------------

-- variant_id null = card level; side null = both sides.
-- An explicit "not relevant" is stored as 0. A missing row uses the level above.
create table public.card_scores (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  variant_id uuid,
  side public.side,
  dimension_id smallint not null references public.score_dimensions (id),
  score smallint not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  foreign key (card_id, variant_id) references public.variants (card_id, id) on delete cascade,
  constraint card_scores_scope_key
    unique nulls not distinct (user_id, card_id, variant_id, side, dimension_id)
);

-- Written only by "Mark reviewed". Covers every variant and both sides.
create table public.card_reviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- Written by the community score job (service role) only.
-- rating_count = people; total_weight includes the fringe default.
create table public.community_scores (
  card_id uuid not null references public.cards (id) on delete cascade,
  variant_id uuid,
  side public.side,
  dimension_id smallint not null references public.score_dimensions (id),
  score numeric(5, 2) not null check (score between 0 and 100),
  rating_count integer not null check (rating_count >= 0),
  total_weight numeric not null check (total_weight >= 0),
  scores_version bigint not null,
  computed_at timestamptz not null default now(),
  foreign key (card_id, variant_id) references public.variants (card_id, id) on delete cascade,
  constraint community_scores_scope_key
    unique nulls not distinct (card_id, variant_id, side, dimension_id)
);

-- ---------------------------------------------------------------------------
-- Decks: a card pool plus loadouts (README "Weapons and equipment")
-- ---------------------------------------------------------------------------

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deck_loadouts (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  name text not null,
  is_default boolean not null default false
);

create unique index deck_loadouts_one_default
  on public.deck_loadouts (deck_id) where is_default;

-- The pool: every card the player brings, including weapons, equipment and sideboard.
create table public.deck_cards (
  deck_id uuid not null references public.decks (id) on delete cascade,
  variant_id uuid not null references public.variants (id),
  quantity smallint not null check (quantity > 0),
  sideboard boolean not null default false,
  primary key (deck_id, variant_id)
);

-- What starts a game. Always a subset of the pool.
create table public.loadout_cards (
  loadout_id uuid not null references public.deck_loadouts (id) on delete cascade,
  variant_id uuid not null references public.variants (id),
  quantity smallint not null check (quantity > 0),
  primary key (loadout_id, variant_id)
);

create function public.create_default_loadout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.deck_loadouts (deck_id, name, is_default) values (new.id, 'Default', true);
  return new;
end;
$$;

create trigger decks_create_default_loadout
  after insert on public.decks
  for each row execute function public.create_default_loadout();

-- Adding a non-sideboard card to the pool adds it to the default loadout.
create function public.add_pool_card_to_default_loadout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.sideboard then
    insert into public.loadout_cards (loadout_id, variant_id, quantity)
    select id, new.variant_id, new.quantity
      from public.deck_loadouts
     where deck_id = new.deck_id and is_default
    on conflict (loadout_id, variant_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger deck_cards_add_to_default_loadout
  after insert on public.deck_cards
  for each row execute function public.add_pool_card_to_default_loadout();

-- Reducing a pool quantity clamps every loadout to the new quantity.
create function public.clamp_loadouts_to_pool()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.loadout_cards lc
     set quantity = new.quantity
    from public.deck_loadouts dl
   where dl.id = lc.loadout_id
     and dl.deck_id = new.deck_id
     and lc.variant_id = new.variant_id
     and lc.quantity > new.quantity;
  return new;
end;
$$;

create trigger deck_cards_clamp_loadouts
  after update of quantity on public.deck_cards
  for each row execute function public.clamp_loadouts_to_pool();

-- Removing a card from the pool removes it from every loadout.
create function public.remove_pool_card_from_loadouts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.loadout_cards lc
   using public.deck_loadouts dl
   where dl.id = lc.loadout_id
     and dl.deck_id = old.deck_id
     and lc.variant_id = old.variant_id;
  return old;
end;
$$;

create trigger deck_cards_remove_from_loadouts
  after delete on public.deck_cards
  for each row execute function public.remove_pool_card_from_loadouts();

-- A loadout can't hold a card the pool doesn't have, or more copies than the pool.
create function public.check_loadout_within_pool()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pool_quantity smallint;
begin
  select dc.quantity into pool_quantity
    from public.deck_loadouts dl
    join public.deck_cards dc on dc.deck_id = dl.deck_id and dc.variant_id = new.variant_id
   where dl.id = new.loadout_id;

  if pool_quantity is null or new.quantity > pool_quantity then
    raise exception 'loadout quantity % exceeds pool quantity % for variant %',
      new.quantity, coalesce(pool_quantity, 0), new.variant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger loadout_cards_within_pool
  before insert or update on public.loadout_cards
  for each row execute function public.check_loadout_within_pool();

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.rater_weights enable row level security;
alter table public.app_settings enable row level security;
alter table public.cards enable row level security;
alter table public.variants enable row level security;
alter table public.score_dimensions enable row level security;
alter table public.card_scores enable row level security;
alter table public.card_reviews enable row level security;
alter table public.community_scores enable row level security;
alter table public.decks enable row level security;
alter table public.deck_loadouts enable row level security;
alter table public.deck_cards enable row level security;
alter table public.loadout_cards enable row level security;

-- Reference data: readable by everyone, written by the service role (importer, job).
revoke insert, update, delete on public.cards, public.variants, public.score_dimensions,
  public.community_scores, public.app_settings, public.rater_weights, public.profiles
  from anon, authenticated;

create policy "Cards are public" on public.cards for select to anon, authenticated using (true);
create policy "Variants are public" on public.variants for select to anon, authenticated using (true);
create policy "Dimensions are public" on public.score_dimensions for select to anon, authenticated using (true);
create policy "Community scores are public" on public.community_scores for select to anon, authenticated using (true);
create policy "Settings are public" on public.app_settings for select to anon, authenticated using (true);

-- Curators and admins can flag fringe cards, and nothing else on cards.
grant update (fringe) on public.cards to authenticated;
create policy "Curators flag fringe cards" on public.cards for update to authenticated
  using (public.current_app_role() in ('curator', 'admin'))
  with check (public.current_app_role() in ('curator', 'admin'));

-- Admins change settings.
grant update (value) on public.app_settings to authenticated;
create policy "Admins change settings" on public.app_settings for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Profiles: users see and update their own preferences. Roles change in the dashboard.
grant update (preferences) on public.profiles to authenticated;
create policy "Users read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_app_role() = 'admin');
create policy "Users update own preferences" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Rating weights: admins only. Never used client-side.
grant update (rating_weight) on public.rater_weights to authenticated;
create policy "Admins read rating weights" on public.rater_weights for select to authenticated
  using (public.current_app_role() = 'admin');
create policy "Admins change rating weights" on public.rater_weights for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- Personal scores and reviews: owner only.
create policy "Users manage own scores" on public.card_scores for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own reviews" on public.card_reviews for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Decks: owner only, including loadouts and cards.
create policy "Users manage own decks" on public.decks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users manage own deck loadouts" on public.deck_loadouts for all to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));

create policy "Users manage own deck cards" on public.deck_cards for all to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid()));

create policy "Users manage own loadout cards" on public.loadout_cards for all to authenticated
  using (exists (
    select 1 from public.deck_loadouts dl join public.decks d on d.id = dl.deck_id
     where dl.id = loadout_id and d.user_id = auth.uid()))
  with check (exists (
    select 1 from public.deck_loadouts dl join public.decks d on d.id = dl.deck_id
     where dl.id = loadout_id and d.user_id = auth.uid()));

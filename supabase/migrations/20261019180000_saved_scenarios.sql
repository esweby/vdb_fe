-- Saved scenarios (README "Saved scenarios", phase two step 6). A definition is data checked
-- by the app against the scenario contract (@vdb/engine scenarioSchema) before it runs.
-- Visibility: private (the default), link (anyone with the link can view and copy it, read by
-- id through shared_scenario, never listed) or library (curated: curators and admins only).

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and btrim(name) <> ''),
  definition jsonb not null check (
    jsonb_typeof(definition) = 'object' and octet_length(definition::text) <= 20000
  ),
  definition_version integer not null check (definition_version >= 1),
  visibility text not null default 'private' check (visibility in ('private', 'link', 'library')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scenarios_user_id on public.scenarios (user_id);
create index scenarios_library on public.scenarios (visibility) where visibility = 'library';

-- Each person's latest result for a scenario on a deck, with every input it used, so a re-run
-- can say what changed (README "Reproducibility").
create table public.scenario_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  deck_snapshot jsonb not null check (octet_length(deck_snapshot::text) <= 20000),
  definition jsonb not null check (octet_length(definition::text) <= 20000),
  definition_version integer not null,
  seed integer not null,
  runs integer not null check (runs between 1 and 1000000),
  settings jsonb not null default '{}' check (octet_length(settings::text) <= 2048),
  scores_version bigint,
  engine_version text not null check (char_length(engine_version) <= 32),
  results jsonb not null check (octet_length(results::text) <= 20000),
  run_at timestamptz not null default now(),
  unique (user_id, scenario_id, deck_id)
);
create index scenario_results_deck on public.scenario_results (user_id, deck_id);

alter table public.scenarios enable row level security;
alter table public.scenario_results enable row level security;

create policy "Users read their own scenarios and the library" on public.scenarios for select
  to authenticated using (user_id = auth.uid() or visibility = 'library');
create policy "Users add their own scenarios" on public.scenarios for insert
  to authenticated with check (user_id = auth.uid());
create policy "Users change their own scenarios" on public.scenarios for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete their own scenarios" on public.scenarios for delete
  to authenticated using (user_id = auth.uid());

create policy "Users manage their own results" on public.scenario_results for all
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.scenarios s
       where s.id = scenario_id and (s.user_id = auth.uid() or s.visibility = 'library')
    )
    -- A deck they can see: their own or a public one (decks' row level security).
    and exists (select 1 from public.decks d where d.id = deck_id)
  );

grant select, insert, update, delete on public.scenarios, public.scenario_results to authenticated;
grant all on public.scenarios, public.scenario_results to service_role;

-- Only curators and admins put a scenario in the library. While it's there, it stays as they
-- picked it: the owner can take it out, but not change it in place.
create function public.guard_scenario_library()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'library'
     and (tg_op = 'INSERT' or old.visibility is distinct from 'library')
     and coalesce(public.current_app_role()::text, '') not in ('curator', 'admin')
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Only curators can add a scenario to the library'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' and old.visibility = 'library' and new.visibility = 'library'
     and (new.name, new.definition, new.definition_version)
         is distinct from (old.name, old.definition, old.definition_version)
     and coalesce(public.current_app_role()::text, '') not in ('curator', 'admin')
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Take the scenario out of the library to change it'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger scenarios_guard_library
  before insert or update on public.scenarios
  for each row execute function public.guard_scenario_library();

-- A scenario shared by link (or in the library, or the caller's own), read by its id.
create function public.shared_scenario(scenario_id uuid)
returns table (
  id uuid,
  name text,
  definition jsonb,
  definition_version integer,
  visibility text,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.definition, s.definition_version, s.visibility,
         s.user_id = auth.uid()
    from public.scenarios s
   where s.id = scenario_id
     and (s.visibility in ('link', 'library') or s.user_id = auth.uid())
$$;

revoke execute on function public.shared_scenario(uuid) from public;
grant execute on function public.shared_scenario(uuid) to anon, authenticated;

-- Curators promote a shared scenario to the library, or take it back out to "link". Private
-- scenarios stay private.
create function public.set_scenario_library(scenario_id uuid, in_library boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_app_role()::text, '') not in ('curator', 'admin') then
    raise exception 'Only curators can change the library'
      using errcode = 'insufficient_privilege';
  end if;
  update public.scenarios
     set visibility = case when in_library then 'library' else 'link' end
   where id = scenario_id and visibility in ('link', 'library');
  if not found then
    raise exception 'No shared scenario with that id' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.set_scenario_library(uuid, boolean) from public, anon;
grant execute on function public.set_scenario_library(uuid, boolean) to authenticated;

-- Plan goals (task 7c, docs/plan-goals.md): a sideboard plan's target success rate for a
-- scenario, either a built-in one (by name) or a saved one the owner can see. Measured in the
-- app; only the target is stored. Owner only, like the plans themselves.

create table public.plan_goals (
  id uuid primary key default gen_random_uuid(),
  loadout_id uuid not null references public.deck_loadouts (id) on delete cascade,
  scenario_id uuid references public.scenarios (id) on delete cascade,
  built_in text check (built_in is null or char_length(built_in) between 1 and 120),
  -- A whole percentage. 0% is always met and 100% never can be, so neither is a goal.
  target smallint not null check (target between 1 and 99),
  created_at timestamptz not null default now(),
  constraint plan_goals_one_scenario check (num_nonnulls(scenario_id, built_in) = 1)
);
create unique index plan_goals_one_per_scenario
  on public.plan_goals (loadout_id, coalesce(scenario_id::text, built_in));

alter table public.plan_goals enable row level security;

create policy "Users manage goals on their own plans" on public.plan_goals for all
  to authenticated
  using (exists (
    select 1 from public.deck_loadouts dl join public.decks d on d.id = dl.deck_id
     where dl.id = loadout_id and not dl.is_default and d.user_id = auth.uid()))
  with check (
    exists (
      select 1 from public.deck_loadouts dl join public.decks d on d.id = dl.deck_id
       where dl.id = loadout_id and not dl.is_default and d.user_id = auth.uid())
    and (scenario_id is null or exists (
      select 1 from public.scenarios s
       where s.id = scenario_id and (s.user_id = auth.uid() or s.visibility = 'library')))
  );

-- At most 10 goals on a plan.
create function public.limit_plan_goals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.deck_loadouts where id = new.loadout_id for update;
  if (select count(*) from public.plan_goals where loadout_id = new.loadout_id) >= 10 then
    raise exception 'A plan holds at most 10 goals' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_plan_goals() from public, anon, authenticated;

create trigger plan_goals_limit
  before insert on public.plan_goals
  for each row execute function public.limit_plan_goals();

revoke all on public.plan_goals from anon, authenticated;
grant select, insert, update, delete on public.plan_goals to authenticated;
grant all on public.plan_goals to service_role;

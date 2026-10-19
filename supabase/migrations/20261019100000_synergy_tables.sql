-- Synergy (phase two, docs/synergy-rules.md and README "Synergy graph"). Edges are directed:
-- "from helps to". Derived edges are computed from card facts in code (@vdb/cards
-- deriveSynergies), so they aren't stored; these tables hold people's opinions of them and
-- the rule weights admins tune.

-- Community edges, from the related-cards picker. A two-way relationship is two rows.
create table public.card_synergies (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_card_id uuid not null references public.cards (id) on delete cascade,
  to_card_id uuid not null references public.cards (id) on delete cascade,
  weight numeric(3, 2) not null check (weight between 0 and 1),
  note text check (char_length(note) <= 280),
  updated_at timestamptz not null default now(),
  primary key (user_id, from_card_id, to_card_id),
  constraint card_synergies_not_self check (from_card_id <> to_card_id)
);

-- Feedback on derived edges, from the confirm-suggestions queue. rule_id names a rule in
-- code (SYNERGY_RULES), so it can't be a foreign key; its shape is checked instead.
create table public.synergy_feedback (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id text not null check (rule_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(rule_id) <= 64),
  from_card_id uuid not null references public.cards (id) on delete cascade,
  to_card_id uuid not null references public.cards (id) on delete cascade,
  verdict text not null check (verdict in ('confirm', 'reject', 'reweight')),
  weight numeric(3, 2) check (weight between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, rule_id, from_card_id, to_card_id),
  constraint synergy_feedback_not_self check (from_card_id <> to_card_id),
  -- confirm: the rule's weight; reject: no edge; reweight: this weight.
  constraint synergy_feedback_weight_matches_verdict
    check ((verdict = 'reweight') = (weight is not null))
);

-- Rule weights set by admins (maintainer, 19 Oct 2026). A row overrides the rule's default
-- weight in code; 0 turns the rule off. No row: the default.
create table public.synergy_rule_weights (
  rule_id text primary key check (rule_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(rule_id) <= 64),
  weight numeric(3, 2) not null check (weight between 0 and 1),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Who changed a weight, and when, whatever the client sends.
create function public.stamp_synergy_rule_weight()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end
$$;

create trigger synergy_rule_weights_stamp
  before insert or update on public.synergy_rule_weights
  for each row execute function public.stamp_synergy_rule_weight();

alter table public.card_synergies enable row level security;
alter table public.synergy_feedback enable row level security;
alter table public.synergy_rule_weights enable row level security;

create policy "Users manage own synergies" on public.card_synergies for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own synergy feedback" on public.synergy_feedback for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Rule weights are public" on public.synergy_rule_weights for select
  to anon, authenticated using (true);
create policy "Admins set rule weights" on public.synergy_rule_weights for insert to authenticated
  with check (public.current_app_role() = 'admin');
create policy "Admins change rule weights" on public.synergy_rule_weights for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');
create policy "Admins remove rule weights" on public.synergy_rule_weights for delete to authenticated
  using (public.current_app_role() = 'admin');

grant select, insert, update, delete on public.card_synergies, public.synergy_feedback to authenticated;
grant select on public.synergy_rule_weights to anon;
grant select, insert, update, delete on public.synergy_rule_weights to authenticated;

-- The server aggregates community edges and feedback (community-scores Edge Function).
grant all on public.card_synergies, public.synergy_feedback, public.synergy_rule_weights to service_role;

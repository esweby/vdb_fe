-- Strategy questions: asked once per person, not per card (README "Card facts vs. opinions":
-- these are opinions). Each person answers for themselves; the scoring group's answers are
-- averaged by strategy_community_answers(), which never returns a single person's answer.
-- Question wording is UNVERIFIED, for the scoring group to confirm.

create table public.strategy_questions (
  key text primary key,
  prompt text not null,
  low_label text not null,
  high_label text not null,
  sort_order smallint not null
);

insert into public.strategy_questions (key, prompt, low_label, high_label, sort_order) values
  ('traverse_to_usurper', 'How important is traversing to Usurper?', 'Stay Forsaken', 'Get there fast', 1),
  ('flip_back_to_forsaken', 'Once on Usurper, how keen are you to flip back to Forsaken?', 'Stay Usurper', 'Flip back often', 2);

create table public.strategy_answers (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_key text not null references public.strategy_questions (key) on delete cascade,
  answer smallint not null check (answer between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_key)
);

alter table public.strategy_questions enable row level security;
alter table public.strategy_answers enable row level security;

create policy "anyone reads strategy questions" on public.strategy_questions
  for select using (true);
create policy "people manage their own strategy answers" on public.strategy_answers
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.strategy_questions to anon, authenticated;
grant select, insert, update, delete on public.strategy_answers to authenticated;

-- The scoring group's average per question: scorers, curators and admins count, as for
-- community scores. Security definer so it can read every answer but return only averages.
create function public.strategy_community_answers()
returns table (question_key text, average numeric, answers bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.question_key, avg(a.answer)::numeric, count(*)
    from public.strategy_answers a
    join public.profiles p on p.id = a.user_id
   where p.role in ('scorer', 'curator', 'admin')
   group by a.question_key
$$;

revoke execute on function public.strategy_community_answers() from public;
grant execute on function public.strategy_community_answers() to anon, authenticated;

-- Effect draft reviews (docs/rules-engine.md, step 9b). An admin's verdict on a card's effect
-- draft (drafted in code from the card's facts), keyed by the draft's hash: when the facts
-- change, the draft and its hash change, and the old verdict no longer applies. Accepting only
-- records the verdict; the engine plays a card once its rules are added to CARD_RULES with
-- signed-off tests. Everyone reads verdicts; only admins write them (maintainer, 20 Oct 2026).
create table public.effect_draft_reviews (
  card_id uuid not null references public.cards (id) on delete cascade,
  draft_hash text not null check (draft_hash ~ '^[0-9a-f]{8}$'),
  verdict text not null check (verdict in ('accepted', 'rejected')),
  note text check (char_length(note) <= 280),
  reviewed_by uuid default auth.uid() references auth.users (id) on delete set null,
  reviewed_at timestamptz not null default now(),
  primary key (card_id, draft_hash)
);

-- Who gave a verdict, and when, whatever the client sends.
create function public.stamp_effect_draft_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end
$$;

create trigger effect_draft_reviews_stamp
  before insert or update on public.effect_draft_reviews
  for each row execute function public.stamp_effect_draft_review();

alter table public.effect_draft_reviews enable row level security;

create policy "Effect draft reviews are public" on public.effect_draft_reviews for select
  to anon, authenticated using (true);
create policy "Admins record effect draft reviews" on public.effect_draft_reviews for insert to authenticated
  with check (public.current_app_role() = 'admin');
create policy "Admins change effect draft reviews" on public.effect_draft_reviews for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');
create policy "Admins remove effect draft reviews" on public.effect_draft_reviews for delete to authenticated
  using (public.current_app_role() = 'admin');

grant select on public.effect_draft_reviews to anon;
grant select, insert, update, delete on public.effect_draft_reviews to authenticated;
grant all on public.effect_draft_reviews to service_role;

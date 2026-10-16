-- Security audit, 16 Oct 2026: limits on what people can write, and no single strategy answer
-- exposed through the average.

-- Deck names: 1 to 80 characters, not blank. Public deck names show to every visitor.
alter table public.decks
  add constraint decks_name_length check (char_length(name) between 1 and 80 and btrim(name) <> '');

-- Pitch targets: only pitches 1 to 3, each a whole number from 0 to 80.
alter table public.decks drop constraint decks_pitch_targets_valid;
alter table public.decks
  add constraint decks_pitch_targets_valid check (
    jsonb_typeof(pitch_targets) = 'object'
    and pitch_targets - '1' - '2' - '3' = '{}'::jsonb
    and not jsonb_path_exists(
      pitch_targets,
      '$.* ? (@.type() != "number" || @ < 0 || @ > 80 || @.floor() != @)'
    )
  );

-- Copies of a card: at most 80, the most a card pool holds.
alter table public.deck_cards
  add constraint deck_cards_quantity_max check (quantity <= 80);
alter table public.loadout_cards
  add constraint loadout_cards_quantity_max check (quantity <= 80);

-- Preferences: an object of at most 2 KB (measured as text, so compression can't hide size).
alter table public.profiles
  add constraint profiles_preferences_small check (
    jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 2048
  );

-- The scoring group's average only from two or more answers: one answer alone is that
-- person's answer.
create or replace function public.strategy_community_answers()
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
  having count(*) >= 2
$$;

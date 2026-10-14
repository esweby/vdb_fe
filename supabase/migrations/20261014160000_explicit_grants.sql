-- Hosted Supabase projects don't grant table access to anon and authenticated by default;
-- local stacks do. Make every grant explicit so both behave the same, and stop local from
-- granting by default so a missing grant fails the tests (supabase/tests/06_privileges).

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, public;

revoke all on
  public.cards, public.variants, public.score_dimensions, public.community_scores,
  public.app_settings, public.profiles, public.rater_weights, public.card_scores,
  public.card_reviews, public.decks, public.deck_cards, public.deck_loadouts,
  public.loadout_cards
  from anon, authenticated;

-- Public reference data: readable by everyone
grant select on
  public.cards, public.variants, public.score_dimensions, public.community_scores,
  public.app_settings
  to anon, authenticated;

-- Signed-in users: row level security decides which rows
grant select, insert, update, delete on
  public.card_scores, public.card_reviews, public.decks, public.deck_cards,
  public.deck_loadouts, public.loadout_cards
  to authenticated;
grant select on public.profiles, public.rater_weights to authenticated;

-- Column-level updates (row level security limits who)
grant update (fringe) on public.cards to authenticated;
grant update (value) on public.app_settings to authenticated;
grant update (preferences) on public.profiles to authenticated;
grant update (rating_weight) on public.rater_weights to authenticated;

-- Functions used by row level security policies
grant execute on function public.current_app_role() to anon, authenticated;

-- The server (Edge Functions, importer via service role)
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

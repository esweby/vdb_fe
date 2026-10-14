-- Schema shape for phase one (README "Tables", docs/phase-one.md M1).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select has_type('public', 'side', 'side enum exists');
select has_type('public', 'app_role', 'app_role enum exists');
select enum_has_labels('public', 'side', array['forsaken', 'usurper']);
select enum_has_labels('public', 'app_role', array['user', 'scorer', 'curator', 'admin']);

select has_table('public', 'profiles', 'profiles');
select has_table('public', 'rater_weights', 'rater_weights (kept apart from profiles so it can be admin-only)');
select has_table('public', 'app_settings', 'app_settings');
select has_table('public', 'cards', 'cards');
select has_table('public', 'variants', 'variants');
select has_table('public', 'score_dimensions', 'score_dimensions');
select has_table('public', 'card_scores', 'card_scores');
select has_table('public', 'card_reviews', 'card_reviews');
select has_table('public', 'community_scores', 'community_scores');
select has_table('public', 'decks', 'decks');
select has_table('public', 'deck_cards', 'deck_cards');
select has_table('public', 'deck_loadouts', 'deck_loadouts');
select has_table('public', 'loadout_cards', 'loadout_cards');

select columns_are('public', 'cards', array[
  'id', 'external_id', 'name', 'type', 'subtypes', 'classes', 'talents', 'keywords',
  'text', 'attributes', 'attributes_verified', 'fringe', 'hidden', 'created_at', 'updated_at'
]);
select columns_are('public', 'card_scores', array[
  'user_id', 'card_id', 'variant_id', 'side', 'dimension_id', 'score', 'updated_at'
]);
select columns_are('public', 'community_scores', array[
  'card_id', 'variant_id', 'side', 'dimension_id', 'score', 'rating_count',
  'total_weight', 'scores_version', 'computed_at'
]);

select results_eq(
  'select key from public.score_dimensions order by sort_order',
  array['runechantCreation', 'gateCreation', 'banish', 'playableFromBanish', 'enablesTraverse', 'utility'],
  'draft score dimensions are seeded in order'
);
select results_eq(
  'select key from public.app_settings order by key',
  array['format_classic_constructed', 'fringe_default', 'fringe_k', 'min_rating_count'],
  'scoring and format settings are seeded'
);

select * from finish();
rollback;

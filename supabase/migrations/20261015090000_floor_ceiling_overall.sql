-- README "Floor, ceiling and overall": three ratings replace the six draft dimensions.
-- Scoring hasn't started, so the old scores, reviews and community scores are dropped
-- rather than migrated (agreed with the maintainer).
delete from public.community_scores;
delete from public.card_scores;
delete from public.card_reviews;
delete from public.score_dimensions;

insert into public.score_dimensions (key, label, sort_order) values
  ('floor', 'Floor', 1),
  ('ceiling', 'Ceiling', 2),
  ('overall', 'Overall', 3);

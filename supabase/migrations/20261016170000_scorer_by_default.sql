-- New accounts join as scorers (maintainer, 16 Oct 2026), so the scoring group can sign up and
-- start straight away. Sign-ups are open, so anyone who signs up counts toward community
-- scores: an admin can set someone back to 'user', or lower their rater_weights.rating_weight.
-- Existing accounts keep their role.

alter table public.profiles alter column role set default 'scorer';

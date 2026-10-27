-- Row level security and column privileges for each role (README "Roles", "Backend").
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures (as postgres)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.local'),   -- user
  ('00000000-0000-0000-0000-0000000000b0', 'bob@test.local'),     -- scorer
  ('00000000-0000-0000-0000-0000000000c0', 'carol@test.local'),   -- curator
  ('00000000-0000-0000-0000-0000000000d0', 'dave@test.local');    -- admin
update public.profiles set role = 'scorer'  where id = '00000000-0000-0000-0000-0000000000b0';
update public.profiles set role = 'curator' where id = '00000000-0000-0000-0000-0000000000c0';
update public.profiles set role = 'admin'   where id = '00000000-0000-0000-0000-0000000000d0';

insert into public.cards (id, external_id, name, type)
  values ('10000000-0000-0000-0000-000000000001', 'ext-card-1', 'Card One', 'action');
insert into public.variants (id, card_id, external_id, pitch)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ext-v-1', 3);
insert into public.card_scores (user_id, card_id, dimension_id, score)
  values ('00000000-0000-0000-0000-0000000000b0', '10000000-0000-0000-0000-000000000001',
          (select id from public.score_dimensions where key = 'overall'), 70);
insert into public.community_scores (card_id, dimension_id, score, rating_count, total_weight, scores_version)
  values ('10000000-0000-0000-0000-000000000001', (select id from public.score_dimensions where key = 'overall'),
          70, 1, 1, 1);
insert into public.decks (id, user_id, name)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Alice deck');
insert into public.deck_cards (deck_id, variant_id, quantity)
  values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2);

-- Anonymous visitors
set local role anon;
select is((select count(*)::int from public.cards where external_id = 'ext-card-1'), 1, 'anon can read cards');
select is((select count(*)::int from public.community_scores where card_id = '10000000-0000-0000-0000-000000000001'), 1, 'anon can read community scores');
select throws_ok($$select count(*) from public.card_scores$$, '42501', null, 'anon cannot read individual scores');
reset role;

-- Alice (user)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.cards (external_id, name, type) values ('x', 'X', 'action')$$,
  '42501', null, 'users cannot add cards'
);
select lives_ok(
  $$insert into public.card_scores (user_id, card_id, dimension_id, score)
    values ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001',
            (select id from public.score_dimensions where key = 'overall'), 40)$$,
  'users can save their own scores'
);
select is((select count(*)::int from public.card_scores), 1, 'users only see their own scores');
select throws_ok(
  $$insert into public.card_scores (user_id, card_id, dimension_id, score)
    values ('00000000-0000-0000-0000-0000000000b0', '10000000-0000-0000-0000-000000000001',
            (select id from public.score_dimensions where key = 'ceiling'), 40)$$,
  '42501', null, 'users cannot save scores as someone else'
);
select lives_ok(
  $$insert into public.card_reviews (user_id, card_id)
    values ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001')$$,
  'users can mark their own reviews'
);
select throws_ok(
  $$insert into public.community_scores (card_id, dimension_id, score, rating_count, total_weight, scores_version)
    values ('10000000-0000-0000-0000-000000000001', (select id from public.score_dimensions where key = 'floor'),
            10, 1, 1, 1)$$,
  '42501', null, 'users cannot write community scores'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'users cannot change their own role'
);
select results_eq(
  $$with u as (update public.profiles set preferences = '{"scoreSidesTogether": false}'
               where id = '00000000-0000-0000-0000-0000000000a1' returning 1)
    select count(*)::int from u$$,
  array[1], 'users can change their own preferences'
);
select is((select count(*)::int from public.profiles), 1, 'users only see their own profile');
select is((select count(*)::int from public.rater_weights), 0, 'users cannot see rating weights');
select results_eq(
  $$with u as (update public.cards set fringe = true where external_id = 'ext-card-1' returning 1) select count(*)::int from u$$,
  array[0], 'users cannot flag fringe cards'
);
-- Private decks only: public decks (anyone's) are readable by everyone.
select is((select count(*)::int from public.decks where visibility = 'private'), 1, 'users see their own decks');
select results_eq(
  $$with u as (update public.app_settings set value = '99' returning 1) select count(*)::int from u$$,
  array[0], 'users cannot change settings'
);
reset role;

-- Bob (scorer) cannot see or touch Alice's deck
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
select is((select count(*)::int from public.decks where visibility = 'private'), 0, 'other users cannot see a deck');
select is((select count(*)::int from public.deck_cards dc join public.decks d on d.id = dc.deck_id where d.visibility = 'private'), 0, 'other users cannot see a deck''s cards');
select throws_ok(
  $$insert into public.deck_cards (deck_id, variant_id, quantity)
    values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1)$$,
  '42501', null, 'other users cannot add cards to a deck'
);
select results_eq(
  $$with u as (update public.cards set fringe = true where external_id = 'ext-card-1' returning 1) select count(*)::int from u$$,
  array[0], 'scorers cannot flag fringe cards'
);
reset role;

-- Carol (curator)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c0","role":"authenticated"}', true);
select results_eq(
  $$with u as (update public.cards set fringe = true where external_id = 'ext-card-1' returning 1) select count(*)::int from u$$,
  array[1], 'curators can flag fringe cards'
);
select throws_ok(
  $$update public.cards set name = 'Renamed' where external_id = 'ext-card-1'$$,
  '42501', null, 'curators cannot change other card facts'
);
select is((select count(*)::int from public.rater_weights), 0, 'curators cannot see rating weights');
reset role;

-- Dave (admin)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d0","role":"authenticated"}', true);
select is((select count(*)::int from public.rater_weights where user_id::text like '00000000-0000-0000-0000-0000000000%'), 4, 'admins can see rating weights');
reset role;

select * from finish();
rollback;

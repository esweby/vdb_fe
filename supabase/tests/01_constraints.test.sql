-- Constraints and data rules (README "Tables", "Weapons and equipment").
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-000000000001', 'ext-card-1', 'Card One', 'action'),
  ('10000000-0000-0000-0000-000000000002', 'ext-card-2', 'Card Two', 'action');
insert into public.variants (id, card_id, external_id, pitch, defense) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ext-v-1r', 1, 3),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'ext-v-1b', 3, 3),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'ext-v-2b', 3, 2);

-- Profiles and weights are created automatically for new users
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'scorer', 'a new user joins as a scorer (maintainer, 16 Oct 2026)'
);
select is(
  (select rating_weight from public.rater_weights where user_id = '00000000-0000-0000-0000-00000000000a'),
  1.0::numeric, 'a new user gets rating_weight 1.0'
);

-- card_scores
select throws_ok(
  $$insert into public.card_scores (user_id, card_id, dimension_id, score)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001',
            (select id from public.score_dimensions where key = 'overall'), 101)$$,
  '23514', null, 'scores above 100 are rejected'
);
select throws_ok(
  $$insert into public.card_scores (user_id, card_id, dimension_id, score)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001',
            (select id from public.score_dimensions where key = 'overall'), -10)$$,
  '23514', null, 'negative scores are rejected'
);
select lives_ok(
  $$insert into public.card_scores (user_id, card_id, variant_id, side, dimension_id, score)
    select '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', v, s,
           (select id from public.score_dimensions where key = 'overall'), 50
    from (values (null::uuid), ('20000000-0000-0000-0000-000000000001'::uuid)) as vv(v),
         (values (null::public.side), ('forsaken'::public.side)) as ss(s)$$,
  'one score per scope: card, card + side, variant, variant + side'
);
select throws_ok(
  $$insert into public.card_scores (user_id, card_id, dimension_id, score)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001',
            (select id from public.score_dimensions where key = 'overall'), 60)$$,
  '23505', null, 'a second card-level score for the same dimension is rejected (NULLS NOT DISTINCT)'
);
select throws_ok(
  $$insert into public.card_scores (user_id, card_id, variant_id, side, dimension_id, score)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001',
            '20000000-0000-0000-0000-000000000001', 'forsaken',
            (select id from public.score_dimensions where key = 'overall'), 60)$$,
  '23505', null, 'a second variant + side score for the same dimension is rejected'
);
select throws_ok(
  $$insert into public.card_scores (user_id, card_id, variant_id, dimension_id, score)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001',
            '20000000-0000-0000-0000-000000000003',
            (select id from public.score_dimensions where key = 'overall'), 60)$$,
  '23503', null, 'a variant must belong to the scored card'
);

-- community_scores
select lives_ok(
  $$insert into public.community_scores (card_id, dimension_id, score, rating_count, total_weight, scores_version)
    values ('10000000-0000-0000-0000-000000000001', (select id from public.score_dimensions where key = 'overall'),
            50, 2, 2, 1)$$,
  'community card-level score inserts'
);
select throws_ok(
  $$insert into public.community_scores (card_id, dimension_id, score, rating_count, total_weight, scores_version)
    values ('10000000-0000-0000-0000-000000000001', (select id from public.score_dimensions where key = 'overall'),
            60, 3, 3, 1)$$,
  '23505', null, 'a second community card-level score for the same dimension is rejected'
);

-- Decks: pool and loadouts
insert into public.decks (id, user_id, name)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Test deck');

select is(
  (select count(*)::int from public.deck_loadouts
    where deck_id = '30000000-0000-0000-0000-000000000001' and is_default),
  1, 'a new deck gets one default loadout'
);
select throws_ok(
  $$insert into public.deck_loadouts (deck_id, name, is_default)
    values ('30000000-0000-0000-0000-000000000001', 'Second default', true)$$,
  '23505', null, 'a deck can only have one default loadout'
);

insert into public.deck_cards (deck_id, variant_id, quantity) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 3);
insert into public.deck_cards (deck_id, variant_id, quantity, sideboard) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 2, true);

select is(
  (select lc.quantity::int from public.loadout_cards lc
     join public.deck_loadouts dl on dl.id = lc.loadout_id
    where dl.deck_id = '30000000-0000-0000-0000-000000000001' and dl.is_default
      and lc.variant_id = '20000000-0000-0000-0000-000000000001'),
  3, 'adding a card to the pool adds it to the default loadout'
);
select is(
  (select count(*)::int from public.loadout_cards lc
     join public.deck_loadouts dl on dl.id = lc.loadout_id
    where dl.deck_id = '30000000-0000-0000-0000-000000000001'
      and lc.variant_id = '20000000-0000-0000-0000-000000000003'),
  0, 'a sideboard card is not added to the default loadout'
);
select throws_ok(
  $$update public.loadout_cards set quantity = 4
    where variant_id = '20000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'a loadout cannot hold more copies than the pool'
);
select throws_ok(
  $$insert into public.loadout_cards (loadout_id, variant_id, quantity)
    select id, '20000000-0000-0000-0000-000000000002', 1 from public.deck_loadouts
    where deck_id = '30000000-0000-0000-0000-000000000001' and is_default$$,
  '23514', null, 'a loadout cannot hold a card that is not in the pool'
);

update public.deck_cards set quantity = 1
  where deck_id = '30000000-0000-0000-0000-000000000001'
    and variant_id = '20000000-0000-0000-0000-000000000001';
select is(
  (select lc.quantity::int from public.loadout_cards lc
    where lc.variant_id = '20000000-0000-0000-0000-000000000001'),
  1, 'reducing the pool quantity clamps loadouts'
);

delete from public.deck_cards
  where deck_id = '30000000-0000-0000-0000-000000000001'
    and variant_id = '20000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.loadout_cards
    where variant_id = '20000000-0000-0000-0000-000000000001'),
  0, 'removing a card from the pool removes it from every loadout'
);

select throws_ok(
  $$insert into public.deck_cards (deck_id, variant_id, quantity)
    values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 0)$$,
  '23514', null, 'pool quantity must be positive'
);

select * from finish();
rollback;

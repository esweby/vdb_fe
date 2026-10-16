-- Limits on what people can write (security audit, 16 Oct 2026). Public deck names show to every
-- visitor, so nothing a user writes can be arbitrarily large.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000011a1', 'limits@test.local');
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000011c1', 'ext-limits-card', 'Limits Card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('20000000-0000-0000-0000-0000000011c1', '10000000-0000-0000-0000-0000000011c1', 'ext-limits-v', 1);
insert into public.decks (id, user_id, name)
  values ('30000000-0000-0000-0000-0000000011d1', '00000000-0000-0000-0000-0000000011a1', 'Limits');

-- Deck names: 1 to 80 characters, not blank.
select throws_ok(
  $$insert into public.decks (user_id, name) values ('00000000-0000-0000-0000-0000000011a1', repeat('x', 81))$$,
  '23514', null, 'a deck name is at most 80 characters'
);
select throws_ok(
  $$insert into public.decks (user_id, name) values ('00000000-0000-0000-0000-0000000011a1', '   ')$$,
  '23514', null, 'a deck name is not blank'
);
select lives_ok(
  $$insert into public.decks (user_id, name) values ('00000000-0000-0000-0000-0000000011a1', repeat('x', 80))$$,
  'an 80-character name is fine'
);

-- Pitch targets: only red, yellow and blue, each a whole number up to 80.
select throws_ok(
  $$update public.decks set pitch_targets = '{"9": 5}' where id = '30000000-0000-0000-0000-0000000011d1'$$,
  '23514', null, 'pitch targets only cover pitches 1 to 3'
);
select throws_ok(
  $$update public.decks set pitch_targets = '{"1": 81}' where id = '30000000-0000-0000-0000-0000000011d1'$$,
  '23514', null, 'a pitch target is at most 80'
);
select throws_ok(
  $$update public.decks set pitch_targets = '{"1": "lots"}' where id = '30000000-0000-0000-0000-0000000011d1'$$,
  '23514', null, 'a pitch target is a number'
);
select lives_ok(
  $$update public.decks set pitch_targets = '{"1": 18, "2": 5, "3": 22}' where id = '30000000-0000-0000-0000-0000000011d1'$$,
  'real pitch targets are fine'
);

-- Card copies: up to 80 (the most a pool holds).
select throws_ok(
  $$insert into public.deck_cards (deck_id, variant_id, quantity)
    values ('30000000-0000-0000-0000-0000000011d1', '20000000-0000-0000-0000-0000000011c1', 81)$$,
  '23514', null, 'a deck holds at most 80 copies of a card'
);
select lives_ok(
  $$insert into public.deck_cards (deck_id, variant_id, quantity)
    values ('30000000-0000-0000-0000-0000000011d1', '20000000-0000-0000-0000-0000000011c1', 3)$$,
  'three copies are fine'
);

-- Preferences: an object, and small.
select throws_ok(
  $$update public.profiles set preferences = '[1, 2]' where id = '00000000-0000-0000-0000-0000000011a1'$$,
  '23514', null, 'preferences are an object'
);
select throws_ok(
  $$update public.profiles set preferences = jsonb_build_object('x', repeat('y', 5000)) where id = '00000000-0000-0000-0000-0000000011a1'$$,
  '23514', null, 'preferences are at most 2 KB'
);
select lives_ok(
  $$update public.profiles set preferences = '{"scoreSidesTogether": false}' where id = '00000000-0000-0000-0000-0000000011a1'$$,
  'real preferences are fine'
);

select * from finish();
rollback;

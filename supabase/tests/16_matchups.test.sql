-- Matchups (the maintainer, 19 Oct 2026): per-hero board plans. Heroes are reference data the
-- importer writes; a matchup is one of a deck's loadouts, tied to an opposing hero.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'heroes', 'opposing heroes live in heroes');
select has_column('public', 'deck_loadouts', 'opponent_hero_id', 'a loadout can be a plan against a hero');

insert into public.heroes (id, external_id, name, classes, talents) values
  ('40000000-0000-0000-0000-0000000008e1', 'ext-hero-1', 'Example Hero', '{Warrior}', '{}');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'mu-owner@test.local'),
  ('00000000-0000-0000-0000-0000000008a2', 'mu-other@test.local');
insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000008c1', 'ext-mu-1', 'Matchup Card', 'action');
insert into public.variants (id, card_id, external_id, pitch) values
  ('11000000-0000-0000-0000-0000000008f1', '10000000-0000-0000-0000-0000000008c1', 'ext-mu-1-r', 1);
insert into public.decks (id, user_id, name) values
  ('30000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000008a1', 'Matchup deck');
insert into public.deck_cards (deck_id, variant_id, quantity, sideboard) values
  ('30000000-0000-0000-0000-0000000008d1', '11000000-0000-0000-0000-0000000008f1', 3, true);

-- Anyone reads heroes; only the server writes them.
set local role anon;
select is((select count(*)::int from public.heroes where name = 'Example Hero'), 1, 'anyone reads heroes');
select throws_ok(
  $$insert into public.heroes (external_id, name) values ('ext-y', 'Made up too')$$,
  '42501', null, 'anon can''t add heroes'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.heroes (external_id, name) values ('ext-x', 'Made up')$$,
  '42501', null, 'signed-in users can''t add heroes'
);
select is((select count(*)::int from public.heroes where name = 'Example Hero'), 1, 'signed-in users read heroes');

-- The owner plans a matchup, with sideboard cards boarded in.
select lives_ok(
  $$insert into public.deck_loadouts (id, deck_id, name, opponent_hero_id)
    values ('50000000-0000-0000-0000-0000000008b1', '30000000-0000-0000-0000-0000000008d1',
            'vs Example Hero', '40000000-0000-0000-0000-0000000008e1')$$,
  'the owner plans a matchup against a hero'
);
select lives_ok(
  $$insert into public.loadout_cards (loadout_id, variant_id, quantity)
    values ('50000000-0000-0000-0000-0000000008b1', '11000000-0000-0000-0000-0000000008f1', 2)$$,
  'and boards in sideboard cards'
);
select throws_ok(
  $$insert into public.loadout_cards (loadout_id, variant_id, quantity)
    values ('50000000-0000-0000-0000-0000000008b1', '11000000-0000-0000-0000-0000000008f1', 4)
    on conflict (loadout_id, variant_id) do update set quantity = excluded.quantity$$,
  '23514', null, 'but never more copies than the pool has'
);
select throws_ok(
  $$insert into public.deck_loadouts (deck_id, name, opponent_hero_id)
    values ('30000000-0000-0000-0000-0000000008d1', 'vs Example Hero again',
            '40000000-0000-0000-0000-0000000008e1')$$,
  '23505', null, 'one plan per hero per deck'
);
select throws_ok(
  $$insert into public.deck_loadouts (deck_id, name, is_default, opponent_hero_id)
    values ('30000000-0000-0000-0000-0000000008d1', 'Default against someone', true,
            '40000000-0000-0000-0000-0000000008e1')$$,
  '23514', null, 'the default loadout is against nobody'
);

select lives_ok(
  $$insert into public.deck_loadouts (deck_id, name) values
      ('30000000-0000-0000-0000-0000000008d1', 'Spare list one'),
      ('30000000-0000-0000-0000-0000000008d1', 'Spare list two')$$,
  'loadouts against nobody aren''t limited to one'
);

-- Someone else
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000008a2","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.deck_loadouts where opponent_hero_id is not null),
  0,
  'nobody else sees a deck''s plans'
);

-- The server: a hero with plans can't be deleted, so nobody's plans vanish.
reset role;
select throws_ok(
  $$delete from public.heroes where id = '40000000-0000-0000-0000-0000000008e1'$$,
  '23503', null, 'a hero with matchup plans isn''t deleted'
);

select * from finish();
rollback;

-- Columns the card importer needs (docs/phase-one.md M2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_column('public', 'variants', 'text', 'variants have their own text (it can differ by pitch)');
select has_column('public', 'variants', 'attributes', 'variants have attribute overrides (values can differ by pitch)');
select col_default_is('public', 'variants', 'attributes', '{}', 'variant attributes default to empty');
select has_column('public', 'cards', 'attributes_verified', 'cards record whether a player has checked their attributes');
select has_column('public', 'cards', 'first_set', 'cards record the set they first came out in');
select col_type_is('public', 'cards', 'first_released', 'date', 'and when, so the newest are reviewed first');

insert into public.cards (id, external_id, name, type)
  values ('10000000-0000-0000-0000-000000000009', 'ext-pitch-4', 'Pitch Four', 'resource');
select lives_ok(
  $$insert into public.variants (card_id, external_id, pitch)
    values ('10000000-0000-0000-0000-000000000009', 'ext-pitch-4-v', 4)$$,
  'pitch 4 is allowed (real cards have it)'
);
select throws_ok(
  $$insert into public.variants (card_id, external_id, pitch)
    values ('10000000-0000-0000-0000-000000000009', 'ext-pitch-neg', -1)$$,
  '23514', null, 'negative pitch is rejected'
);

select * from finish();
rollback;

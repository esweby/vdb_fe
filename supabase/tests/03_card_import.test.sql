-- Columns the card importer needs (docs/phase-one.md M2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_column('public', 'variants', 'text', 'variants have their own text (it can differ by pitch)');
select has_column('public', 'variants', 'attributes', 'variants have attribute overrides (values can differ by pitch)');
select col_default_is('public', 'variants', 'attributes', '''{}''::jsonb', 'variant attributes default to empty');
select has_column('public', 'cards', 'attributes_verified', 'cards record whether a player has checked their attributes');

select * from finish();
rollback;

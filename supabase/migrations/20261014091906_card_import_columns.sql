-- Columns the card importer needs (docs/phase-one.md M2).
-- Pitch variants can differ in text and numbers (e.g. "create 3/2/1 Runechants"),
-- so variants carry their own text and attribute overrides, merged over the card's.

alter table public.variants
  add column text text,
  add column attributes jsonb not null default '{}'::jsonb;

-- Whether a player has checked the card's hand-authored attributes.
alter table public.cards
  add column attributes_verified boolean not null default false;

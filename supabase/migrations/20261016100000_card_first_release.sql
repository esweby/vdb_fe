-- When each card first came out (the earliest dated set it was printed in), so Needs review can
-- put the newest cards first. Filled by the importer from the dataset's sets; null without a date.
-- Columns on an existing table: the table's grants already cover them.

alter table public.cards
  add column first_set text,
  add column first_released date;

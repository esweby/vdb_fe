-- Real cards have pitch 4 (e.g. some Legendary resources), so only reject negatives.
alter table public.variants drop constraint variants_pitch_check;
alter table public.variants add constraint variants_pitch_check check (pitch >= 0);

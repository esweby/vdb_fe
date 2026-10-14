-- Target deck cards per pitch ({"1": 18, "2": 5, "3": 22}); a missing key means no target.
alter table public.decks
  add column pitch_targets jsonb not null default '{}',
  add constraint decks_pitch_targets_valid check (
    jsonb_typeof(pitch_targets) = 'object'
    and not jsonb_path_exists(pitch_targets, '$.* ? (@ < 0)')
  );

-- Card images (docs/phase-one.md backlog, M8): Legend Story's public image URL for the
-- variant's chosen printing. Null when the dataset has none; the app shows a stand-in then.
alter table public.variants add column image_url text;

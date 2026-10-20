-- Effect draft reviews (docs/rules-engine.md, step 9b): an admin's verdict on a card's effect
-- draft, keyed by the draft's hash so a verdict goes stale when the card's facts change. Everyone
-- reads them; only admins write (maintainer, 20 Oct 2026).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'effect_draft_reviews', 'verdicts on effect drafts live in effect_draft_reviews');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'edr-scorer@test.local'),
  ('00000000-0000-0000-0000-0000000009a3', 'edr-admin@test.local');
update public.profiles set role = 'scorer' where id = '00000000-0000-0000-0000-0000000009a1';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000009a3';

insert into public.cards (id, external_id, name, type) values
  ('10000000-0000-0000-0000-0000000009c1', 'ext-edr-1', 'Draft One', 'action');

-- Constraints
select throws_ok(
  $$insert into public.effect_draft_reviews (card_id, draft_hash, verdict)
    values ('10000000-0000-0000-0000-0000000009c1', 'abc', 'accepted')$$,
  '23514', null, 'a draft hash is 8 lower-case hex digits'
);
select throws_ok(
  $$insert into public.effect_draft_reviews (card_id, draft_hash, verdict)
    values ('10000000-0000-0000-0000-0000000009c1', '0a1b2c3d', 'maybe')$$,
  '23514', null, 'the verdict is accepted or rejected'
);
select throws_ok(
  $$insert into public.effect_draft_reviews (card_id, draft_hash, verdict, note)
    values ('10000000-0000-0000-0000-0000000009c1', '0a1b2c3d', 'rejected', repeat('x', 281))$$,
  '23514', null, 'a note is at most 280 characters'
);

-- A scorer can't record a verdict
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.effect_draft_reviews (card_id, draft_hash, verdict)
    values ('10000000-0000-0000-0000-0000000009c1', '0a1b2c3d', 'accepted')$$,
  '42501', null, 'a scorer can''t record a verdict'
);
reset role;

-- An admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009a3","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.effect_draft_reviews (card_id, draft_hash, verdict, reviewed_by)
    values ('10000000-0000-0000-0000-0000000009c1', '0a1b2c3d', 'rejected', '00000000-0000-0000-0000-0000000009a1')$$,
  'an admin records a verdict'
);
select is(
  (select reviewed_by from public.effect_draft_reviews where draft_hash = '0a1b2c3d'),
  '00000000-0000-0000-0000-0000000009a3'::uuid,
  'the verdict records who gave it, whatever the client sends'
);
select lives_ok(
  $$update public.effect_draft_reviews set verdict = 'accepted', note = 'Matches the printed text'
    where draft_hash = '0a1b2c3d'$$,
  'and changes it'
);
select throws_ok(
  $$insert into public.effect_draft_reviews (card_id, draft_hash, verdict)
    values ('10000000-0000-0000-0000-0000000009c1', '0a1b2c3d', 'rejected')$$,
  '23505', null, 'one verdict per card and draft'
);
select lives_ok(
  $$insert into public.effect_draft_reviews (card_id, draft_hash, verdict)
    values ('10000000-0000-0000-0000-0000000009c1', 'ffff0000', 'rejected')$$,
  'a changed draft takes a verdict of its own'
);
select lives_ok(
  $$delete from public.effect_draft_reviews where draft_hash = 'ffff0000'$$,
  'and an admin takes a verdict back'
);
reset role;

-- Back to the scorer: they read the verdict, but changing or removing it does nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}', true);
select is(
  (select verdict from public.effect_draft_reviews where draft_hash = '0a1b2c3d'),
  'accepted', 'anyone signed in reads verdicts'
);
update public.effect_draft_reviews set verdict = 'rejected' where draft_hash = '0a1b2c3d';
delete from public.effect_draft_reviews where draft_hash = '0a1b2c3d';
reset role;
select is(
  (select verdict from public.effect_draft_reviews where draft_hash = '0a1b2c3d'),
  'accepted', 'a scorer''s change to a verdict is ignored'
);

-- Visitors
set local role anon;
select is(
  (select count(*)::int from public.effect_draft_reviews),
  1, 'visitors read verdicts'
);
select throws_ok(
  $$insert into public.effect_draft_reviews (card_id, draft_hash, verdict)
    values ('10000000-0000-0000-0000-0000000009c1', '12345678', 'accepted')$$,
  '42501', null, 'visitors can''t record a verdict'
);
reset role;

-- A deleted card takes its verdicts with it
delete from public.cards where id = '10000000-0000-0000-0000-0000000009c1';
select is((select count(*)::int from public.effect_draft_reviews), 0, 'a deleted card''s verdicts go with it');

select * from finish();
rollback;

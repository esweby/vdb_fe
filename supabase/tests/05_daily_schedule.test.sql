-- The community score job runs daily at 03:00 (docs/phase-one.md M3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(
  (select schedule from cron.job where jobname = 'community-scores-daily'),
  '0 3 * * *',
  'the job is scheduled daily at 03:00'
);
select matches(
  (select command from cron.job where jobname = 'community-scores-daily'),
  'invoke_community_scores_job',
  'the schedule runs invoke_community_scores_job'
);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'cron@test.local');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok(
  $$select public.invoke_community_scores_job()$$,
  '42501', null, 'signed-in users cannot trigger the job'
);
reset role;

-- Without the vault secret project_url it does nothing rather than fail.
delete from vault.secrets where name in ('project_url', 'service_role_key');
select lives_ok(
  $$select public.invoke_community_scores_job()$$,
  'it runs without project_url'
);
select is(
  public.invoke_community_scores_job(),
  null,
  'and makes no request without them'
);

select * from finish();
rollback;

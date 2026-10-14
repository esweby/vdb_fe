-- The daily job proves itself with a single-use token instead of a secret key.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- consume_job_nonce: single use, short-lived, server only
insert into public.job_nonces (nonce) values ('11111111-1111-1111-1111-111111111111');
insert into public.job_nonces (nonce, created_at)
  values ('22222222-2222-2222-2222-222222222222', now() - interval '10 minutes');

set local role service_role;
select is(public.consume_job_nonce('11111111-1111-1111-1111-111111111111'), true, 'a fresh token is accepted');
select is(public.consume_job_nonce('11111111-1111-1111-1111-111111111111'), false, 'a token only works once');
select is(public.consume_job_nonce('22222222-2222-2222-2222-222222222222'), false, 'an old token is refused');
select is(public.consume_job_nonce('33333333-3333-3333-3333-333333333333'), false, 'an unknown token is refused');
reset role;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f2', 'nonce@test.local');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select throws_ok(
  $$select public.consume_job_nonce('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'signed-in users cannot use tokens'
);
select throws_ok(
  $$select count(*) from public.job_nonces$$,
  '42501', null, 'signed-in users cannot see tokens'
);
reset role;

-- invoke_community_scores_job: needs only project_url, and creates a token per call
delete from vault.secrets where name in ('project_url', 'service_role_key');
select is(public.invoke_community_scores_job(), null, 'does nothing without project_url');

select vault.create_secret('http://127.0.0.1:9', 'project_url');
select isnt(
  (select public.invoke_community_scores_job()),
  null,
  'sends a request with only project_url set (no service_role_key needed)'
);

select * from finish();
rollback;

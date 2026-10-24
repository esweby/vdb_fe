-- The server reserves attempts before checking a password; callers cannot reset the limits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
select has_table('public', 'sign_in_limits', 'attempt budgets are stored in the database');
select has_function('public', 'reserve_sign_in_attempt', array['text', 'text'], 'the server can reserve an attempt atomically');

select ok((select relrowsecurity from pg_class where oid = 'public.sign_in_limits'::regclass), 'budgets have row level security');
select ok(not has_function_privilege('anon', 'public.reserve_sign_in_attempt(text,text)', 'EXECUTE'), 'anon cannot reserve attempts');
select ok(not has_function_privilege('authenticated', 'public.reserve_sign_in_attempt(text,text)', 'EXECUTE'), 'signed-in users cannot reserve attempts');
set local role service_role;
select ok(public.reserve_sign_in_attempt('Limit_User', '203.0.113.1'), 'the server can reserve an attempt');
reset role;
select is((select attempts from public.sign_in_limits where bucket = 'account:limit_user'), 1, 'account names are case insensitive');
update public.sign_in_limits set attempts = 5 where bucket = 'account:limit_user';
select is(public.reserve_sign_in_attempt('LIMIT_USER', '203.0.113.2'), false, 'another address cannot bypass the account budget');
select is((select attempts from public.sign_in_limits where bucket = 'account:limit_user'), 5, 'blocked attempts do not grow the counter');
insert into public.sign_in_limits (bucket, attempts) values ('address:203.0.113.3', 30);
select is(public.reserve_sign_in_attempt('Fresh_User', '203.0.113.3'), false, 'changing accounts cannot bypass the address budget');
update public.sign_in_limits set started_at = clock_timestamp() - interval '16 minutes' where bucket = 'account:limit_user';
select is(public.reserve_sign_in_attempt('Limit_User', '203.0.113.2'), true, 'the budget becomes available after 15 minutes');
select is((select attempts from public.sign_in_limits where bucket = 'account:limit_user'), 1, 'an expired budget restarts at one');
insert into public.sign_in_limits (bucket, attempts, started_at) values ('account:old_user', 1, clock_timestamp() - interval '2 days');
select public.reserve_sign_in_attempt('Cleanup_User', '203.0.113.4');
select is((select count(*)::int from public.sign_in_limits where bucket = 'account:old_user'), 0, 'old budgets are cleaned without a worker');
select throws_ok($$select public.reserve_sign_in_attempt('bad name', '203.0.113.5')$$, '22023', null, 'invalid budget keys are rejected');
select * from finish();
rollback;

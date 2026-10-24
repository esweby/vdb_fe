-- Reserve attempts before checking passwords, including successful sign-ins. Row locks
-- serialise concurrent requests. Only username-sign-in's server client may call this.
create table public.sign_in_limits (
  bucket text primary key,
  attempts integer not null check (attempts >= 0),
  started_at timestamptz not null default clock_timestamp()
);
create index sign_in_limits_started_at on public.sign_in_limits (started_at);
alter table public.sign_in_limits enable row level security;
-- Server-only state: no anon/authenticated grants or policies.
revoke all on public.sign_in_limits from anon, authenticated;
grant select, insert, update, delete on public.sign_in_limits to service_role;

create function public.reserve_sign_in_attempt(p_username text, p_ip text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_bucket text := 'account:' || lower(p_username);
  address_bucket text := 'address:' || p_ip;
  account_attempts integer;
  address_attempts integer;
  checked_at timestamptz;
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9_-]{3,24}$'
     or p_ip is null or char_length(p_ip) not between 1 and 64 then
    raise exception 'Invalid sign-in limit key' using errcode = '22023';
  end if;

  -- Every call takes account then address locks, so shared addresses cannot deadlock.
  insert into public.sign_in_limits (bucket, attempts) values (account_bucket, 0)
    on conflict (bucket) do nothing;
  perform 1 from public.sign_in_limits where bucket = account_bucket for update;
  insert into public.sign_in_limits (bucket, attempts) values (address_bucket, 0)
    on conflict (bucket) do nothing;
  perform 1 from public.sign_in_limits where bucket = address_bucket for update;

  checked_at := clock_timestamp();
  update public.sign_in_limits set attempts = 0, started_at = checked_at
    where bucket in (account_bucket, address_bucket)
      and started_at <= checked_at - interval '15 minutes';
  select attempts into account_attempts from public.sign_in_limits where bucket = account_bucket;
  select attempts into address_attempts from public.sign_in_limits where bucket = address_bucket;
  -- The account budget cannot be bypassed by changing the supplied address. The address
  -- budget allows several people behind one connection, but bounds password spraying.
  if account_attempts >= 5 or address_attempts >= 30 then
    return false;
  end if;
  update public.sign_in_limits set attempts = attempts + 1
    where bucket in (account_bucket, address_bucket);

  -- Bound cleanup work per call; skip rows another sign-in is using. No extra worker.
  delete from public.sign_in_limits where bucket in (
    select bucket from public.sign_in_limits
      where started_at < checked_at - interval '1 day'
      order by started_at limit 100 for update skip locked
  );
  return true;
end;
$$;
revoke all on function public.reserve_sign_in_attempt(text, text) from public, anon, authenticated;
grant execute on function public.reserve_sign_in_attempt(text, text) to service_role;

-- The daily job proves itself to the community-scores function with a single-use token,
-- instead of sending a secret key that has to match the function's environment.
-- Only the Vault secret project_url is needed; service_role_key is no longer used.

create table public.job_nonces (
  nonce uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.job_nonces enable row level security;
revoke all on public.job_nonces from anon, authenticated;
grant all on public.job_nonces to service_role;

-- Accepts a token once, within 5 minutes of it being created.
create function public.consume_job_nonce(token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_row boolean;
begin
  delete from public.job_nonces
   where nonce = token and created_at > now() - interval '5 minutes'
  returning true into found_row;
  -- Old tokens are cleared out as we go.
  delete from public.job_nonces where created_at <= now() - interval '5 minutes';
  return coalesce(found_row, false);
end;
$$;
revoke execute on function public.consume_job_nonce(uuid) from public, anon, authenticated;
grant execute on function public.consume_job_nonce(uuid) to service_role;

create or replace function public.invoke_community_scores_job()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  token uuid;
begin
  select decrypted_secret into project_url
    from vault.decrypted_secrets where name = 'project_url';

  if project_url is null then
    raise notice 'community-scores job skipped: vault secret project_url is not set';
    return null;
  end if;

  insert into public.job_nonces default values returning nonce into token;

  return net.http_post(
    url := project_url || '/functions/v1/community-scores',
    headers := jsonb_build_object(
      'x-job-token', token::text,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
end;
$$;

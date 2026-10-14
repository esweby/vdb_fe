-- Runs the community score job daily at 03:00, as a safety net behind the app calling it
-- after each "Mark reviewed" (docs/phase-one.md M3).
--
-- Needs two Vault secrets, added in the Supabase dashboard (Project Settings → Vault):
--   project_url       e.g. https://<project-ref>.supabase.co
--   service_role_key  the project's service role key
-- Until both exist, the job does nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function public.invoke_community_scores_job()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  service_role_key text;
begin
  select decrypted_secret into project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_role_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if project_url is null or service_role_key is null then
    raise notice 'community-scores job skipped: vault secrets project_url and service_role_key are not set';
    return null;
  end if;

  return net.http_post(
    url := project_url || '/functions/v1/community-scores',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.invoke_community_scores_job() from public, anon, authenticated;

select cron.schedule(
  'community-scores-daily',
  '0 3 * * *',
  $$select public.invoke_community_scores_job()$$
);

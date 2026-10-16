-- Optional usernames (maintainer, 16 Oct 2026): chosen at sign-up or on the Account page, and
-- shown as the author of public decks. Profiles stay private: others read usernames only,
-- through public.usernames().

alter table public.profiles
  add column username text
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_-]{3,24}$');

-- Unique ignoring case, so "Edd" and "edd" can't both exist.
create unique index profiles_username_unique on public.profiles (lower(username));

-- People set their own (row level security limits updates to their own profile).
grant update (username) on public.profiles to authenticated;

-- Sign-up passes the chosen username as user metadata. A missing, invalid or taken one leaves
-- it blank rather than failing the sign-up; it can be set later on the Account page.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');
begin
  if wanted is not null and wanted !~ '^[A-Za-z0-9_-]{3,24}$' then
    wanted := null;
  end if;
  begin
    insert into public.profiles (id, username) values (new.id, wanted);
  exception when unique_violation then
    insert into public.profiles (id) values (new.id);
  end;
  insert into public.rater_weights (user_id) values (new.id);
  return new;
end;
$$;

-- Usernames for a set of people (deck authors), and nothing else from their profiles.
create function public.usernames(ids uuid[])
returns table (id uuid, username text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username from public.profiles p
   where p.id = any (ids) and p.username is not null
$$;

-- Whether a username can be chosen: valid, and nobody has it in any case.
create function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select name ~ '^[A-Za-z0-9_-]{3,24}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(name))
$$;

revoke execute on function public.usernames(uuid[]) from public;
revoke execute on function public.username_available(text) from public;
grant execute on function public.usernames(uuid[]) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- Usernames can't be changed once set (maintainer, 20 Oct 2026: "Usernames shouldn't be changeable
-- after registration"). An account without one can still set it, once. No new table or grant:
-- people keep `update (username)` on their own profile, for that first time.
create function public.username_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'A username can''t be changed once it''s set.';
  end if;
  return new;
end
$$;

create trigger profiles_username_locked
  before update of username on public.profiles
  for each row execute function public.username_locked();

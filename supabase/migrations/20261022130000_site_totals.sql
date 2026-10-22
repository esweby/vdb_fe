-- Site totals for admins (maintainer, 22 Oct 2026): how many people have signed up and how many
-- decks they have built. Counts only; admins' own accounts and decks are left out.

create function public.admin_site_totals()
returns table (users bigint, users_last_7d bigint, decks bigint, public_decks bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.profiles p where p.role <> 'admin'),
    (select count(*) from public.profiles p where p.role <> 'admin' and p.created_at >= now() - interval '7 days'),
    (select count(*) from public.decks d join public.profiles p on p.id = d.user_id where p.role <> 'admin'),
    (select count(*) from public.decks d join public.profiles p on p.id = d.user_id where p.role <> 'admin' and d.is_public);
end;
$$;

revoke execute on function public.admin_site_totals() from public, anon;
grant execute on function public.admin_site_totals() to authenticated;

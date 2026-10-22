-- Review engagement for admins (maintainer, 22 Oct 2026): how many people use each reviewing
-- area, and how much. Row level security keeps an admin from reading other people's rows, so
-- these security definer functions return counts only. Admins' own activity is left out.
-- Each item is counted once, on the day it was last changed.

create function public.admin_review_engagement()
returns table (
  area text,
  people bigint,
  items bigint,
  items_per_person numeric,
  people_last_7d bigint,
  items_last_7d bigint,
  first timestamptz,
  latest timestamptz
)
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
  with actions as (
    select 'Card scoring' as area, user_id, reviewed_at as at from public.card_reviews
    union all select 'Synergy verdicts', user_id, updated_at from public.synergy_feedback
    union all select 'Synergy links added', user_id, updated_at from public.card_synergies
    union all select 'Strategy questions', user_id, updated_at from public.strategy_answers
  ), counted as (
    select a.area, a.user_id, a.at
    from actions a join public.profiles p on p.id = a.user_id and p.role <> 'admin'
  )
  select
    areas.area,
    count(distinct c.user_id),
    count(c.at),
    round(count(c.at)::numeric / nullif(count(distinct c.user_id), 0), 1),
    count(distinct c.user_id) filter (where c.at >= now() - interval '7 days'),
    count(c.at) filter (where c.at >= now() - interval '7 days'),
    min(c.at),
    max(c.at)
  from (values ('Card scoring'), ('Synergy verdicts'), ('Synergy links added'), ('Strategy questions')) as areas (area)
  left join counted c on c.area = areas.area
  group by areas.area
  order by areas.area;
end;
$$;

create function public.admin_review_engagement_daily(days int default 14)
returns table (day date, area text, people bigint, items bigint)
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
  with actions as (
    select 'Card scoring' as area, user_id, reviewed_at as at from public.card_reviews
    union all select 'Synergy verdicts', user_id, updated_at from public.synergy_feedback
    union all select 'Synergy links added', user_id, updated_at from public.card_synergies
    union all select 'Strategy questions', user_id, updated_at from public.strategy_answers
  )
  select a.at::date, a.area, count(distinct a.user_id), count(*)
  from actions a join public.profiles p on p.id = a.user_id and p.role <> 'admin'
  where a.at >= (current_date - greatest(days, 1) + 1)
  group by a.at::date, a.area
  order by a.at::date desc, a.area;
end;
$$;

revoke execute on function public.admin_review_engagement() from public, anon;
revoke execute on function public.admin_review_engagement_daily(int) from public, anon;
grant execute on function public.admin_review_engagement() to authenticated;
grant execute on function public.admin_review_engagement_daily(int) to authenticated;

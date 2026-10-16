-- Failed username sign-ins (security review, 16 Oct 2026). Sign-ins by username all reach
-- Supabase Auth from the username-sign-in function, so Auth's per-address limit can't tell
-- guessers apart; the function counts failures per username and caller address here instead.
-- Only the server reads or writes it.

create table public.sign_in_failures (
  id bigint generated always as identity primary key,
  username text not null,
  ip text not null,
  failed_at timestamptz not null default now()
);

create index sign_in_failures_recent on public.sign_in_failures (username, ip, failed_at desc);

alter table public.sign_in_failures enable row level security;
revoke all on public.sign_in_failures from anon, authenticated;
grant select, insert, delete on public.sign_in_failures to service_role;

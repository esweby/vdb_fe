-- Local development data only. Seeds run on `supabase db reset` locally, never in production.
-- Dev accounts (local stack only):
--   dev-scorer@vdb.test  /  local-dev-password   (role: scorer)
--   dev-user@vdb.test    /  local-dev-password   (role: user)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'dev-scorer@vdb.test', extensions.crypt('local-dev-password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'dev-user@vdb.test', extensions.crypt('local-dev-password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users where email in ('dev-scorer@vdb.test', 'dev-user@vdb.test');

update public.profiles set role = 'scorer' where id = 'd0000000-0000-0000-0000-000000000001';

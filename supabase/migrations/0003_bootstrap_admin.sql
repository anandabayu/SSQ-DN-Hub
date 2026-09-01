-- ============================================================================
-- Bootstrap the first admin.
--
-- Chicken-and-egg: only an admin can create users, so the very first admin has
-- to be made by hand. Do this once, then every other account is created from
-- the Users page in the app.
--
-- 1. Supabase Dashboard -> Authentication -> Users -> "Add user"
--      - enter your email and a password
--      - tick "Auto Confirm User"
--    The on_auth_user_created trigger writes a matching profiles row as a
--    plain member.
--
-- 2. Run the statement below with your email to promote that row.
-- ============================================================================

update public.profiles
set role = 'admin',
    can_access_salary = true
where id = (
  select id from auth.users where email = 'ananda@ssq.com'
);

-- Verify — this should return one row with role = 'admin'.
-- select p.alias, p.role, p.can_access_salary
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where u.email = 'you@example.com';


-- ---------------------------------------------------------------------------
-- Discord webhooks. Admin-only in RLS, so add them here or from an admin
-- session — never from a client. Mark exactly one as the default.
-- ---------------------------------------------------------------------------
-- insert into public.webhooks (name, url, is_default)
-- values ('Main channel', 'https://discord.com/api/webhooks/...', true);

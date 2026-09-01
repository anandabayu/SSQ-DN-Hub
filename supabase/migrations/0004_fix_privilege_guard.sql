-- ============================================================================
-- Fix: the privilege guard also blocked trusted contexts.
--
-- guard_profile_privileges() reverts changes to role / can_access_salary /
-- is_active when the caller is not an admin. That is right for API traffic,
-- but `is_admin()` reads auth.uid(), which is NULL outside a logged-in
-- PostgREST request — so the guard also reverted:
--
--   * the SQL editor (bootstrapping the first admin)
--   * migrations and psql
--   * server routes using the service role key
--
-- The bootstrap update appeared to succeed and silently did nothing.
--
-- Fix: skip the guard for privileged roles. They already bypass RLS entirely,
-- so a trigger refusing them adds no security — it only breaks the one path
-- that has to work before any admin exists.
-- ============================================================================

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Trusted contexts: `postgres` is the SQL editor and migrations,
  -- `service_role` is our own server routes. Neither goes through RLS.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    new.updated_at := now();
    return new;
  end if;

  -- API traffic: a member may edit their own alias and discord_id, but any
  -- attempt to change privilege columns is reverted rather than rejected.
  if not public.is_admin() then
    new.role              := old.role;
    new.can_access_salary := old.can_access_salary;
    new.is_active         := old.is_active;
  end if;

  new.updated_at := now();
  return new;
end;
$fn$;

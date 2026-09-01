-- ============================================================================
-- SSQ DN Hub - row level security
--
-- RLS is the security boundary. The nav only hides links; these policies are
-- what actually stop a member from reading another member's tracker or any
-- salary data. Every table below has RLS enabled - a table without it is
-- world-readable to any authenticated user.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers.
--
-- These MUST be `security definer`: a policy on `characters` that subqueries
-- `profiles` would re-enter profiles' own RLS and recurse. `security definer`
-- runs as the function owner and skips RLS for this one lookup.
--
-- `set search_path = public` is not optional - without it a security definer
-- function is a privilege-escalation vector.
--
-- `stable` lets Postgres evaluate these once per statement rather than once
-- per row.
-- ---------------------------------------------------------------------------

create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$fn$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'admin'
  );
$fn$;

create or replace function public.has_salary_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active
      and (can_access_salary or role = 'admin')
  );
$fn$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins read every profile: needed for the user-management page and to
-- populate the tracker's user dropdown.
create policy "profiles: admin reads all"
  on public.profiles for select
  using (public.is_admin());

-- Members may edit their own alias / discord_id. The trigger below reverts any
-- attempt to change role, can_access_salary or is_active.
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles: admin updates all"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- RLS cannot restrict individual columns, so privilege columns are guarded
-- here instead: a non-admin's changes to them are silently reverted.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    new.role              := old.role;
    new.can_access_salary := old.can_access_salary;
    new.is_active         := old.is_active;
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- Tracker: activities, characters, completions
--
-- Two permissive policies per table. Postgres ORs them, so the owner gets full
-- control and admins additionally get SELECT. Admins have no insert/update/
-- delete policy here, which is what makes their access READ-ONLY.
-- ---------------------------------------------------------------------------
alter table public.activities  enable row level security;
alter table public.characters  enable row level security;
alter table public.completions enable row level security;

create policy "activities: owner full"
  on public.activities for all
  using (auth.uid() = user_id and public.is_active_user())
  with check (auth.uid() = user_id and public.is_active_user());

create policy "activities: admin read only"
  on public.activities for select
  using (public.is_admin());

create policy "characters: owner full"
  on public.characters for all
  using (auth.uid() = user_id and public.is_active_user())
  with check (auth.uid() = user_id and public.is_active_user());

create policy "characters: admin read only"
  on public.characters for select
  using (public.is_admin());

create policy "completions: owner full"
  on public.completions for all
  using (auth.uid() = user_id and public.is_active_user())
  with check (auth.uid() = user_id and public.is_active_user());

create policy "completions: admin read only"
  on public.completions for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- webhooks - the only secret in the database.
--
-- Admin-only, full stop. Salary users still send to Discord: the server route
-- resolves the URL with the service role key, so it never reaches a browser.
-- No policy exists for non-admins, and RLS denies by default when no policy
-- matches - so a member querying this table gets zero rows, not an error.
-- ---------------------------------------------------------------------------
alter table public.webhooks enable row level security;

create policy "webhooks: admin only"
  on public.webhooks for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Salary tables - gated on the single can_access_salary flag.
-- ---------------------------------------------------------------------------
alter table public.roster_users enable row level security;
alter table public.runs         enable row level security;
alter table public.run_players  enable row level security;
alter table public.loot_items   enable row level security;

create policy "roster_users: salary access"
  on public.roster_users for all
  using (public.has_salary_access())
  with check (public.has_salary_access());

create policy "runs: salary access"
  on public.runs for all
  using (public.has_salary_access())
  with check (public.has_salary_access());

-- Child rows inherit the parent's gate. The `exists` against runs is filtered
-- by runs' own policy, so an unauthorised caller sees no parent and therefore
-- no children.
create policy "run_players: salary access"
  on public.run_players for all
  using (
    public.has_salary_access()
    and exists (select 1 from public.runs r where r.id = run_id)
  )
  with check (
    public.has_salary_access()
    and exists (select 1 from public.runs r where r.id = run_id)
  );

create policy "loot_items: salary access"
  on public.loot_items for all
  using (
    public.has_salary_access()
    and exists (select 1 from public.runs r where r.id = run_id)
  )
  with check (
    public.has_salary_access()
    and exists (select 1 from public.runs r where r.id = run_id)
  );

-- ---------------------------------------------------------------------------
-- app_settings - non-secret shared config. Salary users read, admins write.
-- ---------------------------------------------------------------------------
alter table public.app_settings enable row level security;

create policy "app_settings: salary reads"
  on public.app_settings for select
  using (public.has_salary_access());

create policy "app_settings: admin writes"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

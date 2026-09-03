-- ============================================================================
-- Party ownership.
--
-- Until now any salary user could write any party. Now:
--
--   * everyone with salary access can READ every party
--   * only the creator can WRITE their own party
--   * admins can write all of them
--
-- The old policies were `for all`, which covers select and write together.
-- They are replaced with per-command policies so read and write can diverge.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Can the caller modify this party?
--
-- `security definer` for the same reason as the other helpers: it is called
-- from policies on run_players and loot_items, and reading `runs` from inside
-- those would otherwise re-enter runs' own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.can_edit_run(p_run_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select public.has_salary_access()
     and exists (
       select 1 from public.runs r
       where r.id = p_run_id
         and (r.created_by = auth.uid() or public.is_admin())
     );
$fn$;

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------
drop policy if exists "runs: salary access" on public.runs;

create policy "runs: salary reads all"
  on public.runs for select
  using (public.has_salary_access());

-- A party is always created owned by whoever created it — there is no path
-- that lets someone insert a party under another person's name.
create policy "runs: create own"
  on public.runs for insert
  with check (public.has_salary_access() and created_by = auth.uid());

create policy "runs: creator or admin updates"
  on public.runs for update
  using (
    public.has_salary_access()
    and (created_by = auth.uid() or public.is_admin())
  )
  with check (
    public.has_salary_access()
    and (created_by = auth.uid() or public.is_admin())
  );

create policy "runs: creator or admin deletes"
  on public.runs for delete
  using (
    public.has_salary_access()
    and (created_by = auth.uid() or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- run_players and loot_items follow the parent party.
-- ---------------------------------------------------------------------------
drop policy if exists "run_players: salary access" on public.run_players;

create policy "run_players: salary reads all"
  on public.run_players for select
  using (public.has_salary_access());

create policy "run_players: editable party insert"
  on public.run_players for insert
  with check (public.can_edit_run(run_id));

create policy "run_players: editable party update"
  on public.run_players for update
  using (public.can_edit_run(run_id))
  with check (public.can_edit_run(run_id));

create policy "run_players: editable party delete"
  on public.run_players for delete
  using (public.can_edit_run(run_id));

drop policy if exists "loot_items: salary access" on public.loot_items;

create policy "loot_items: salary reads all"
  on public.loot_items for select
  using (public.has_salary_access());

create policy "loot_items: editable party insert"
  on public.loot_items for insert
  with check (public.can_edit_run(run_id));

create policy "loot_items: editable party update"
  on public.loot_items for update
  using (public.can_edit_run(run_id))
  with check (public.can_edit_run(run_id));

create policy "loot_items: editable party delete"
  on public.loot_items for delete
  using (public.can_edit_run(run_id));

-- ---------------------------------------------------------------------------
-- Existing parties with no creator recorded would become admin-only, which is
-- not what anyone intends for data that predates this migration. Hand them to
-- the first admin so they stay editable.
-- ---------------------------------------------------------------------------
update public.runs
set created_by = (
  select id from public.profiles
  where role = 'admin' and is_active
  order by created_at
  limit 1
)
where created_by is null;

-- ============================================================================
-- Delegated party editors.
--
-- 0007 tied write access to whoever created the party, which breaks the common
-- case: an admin sets up the party but someone else is holding the loot and
-- needs to tick items off. This lets the creator (or an admin) hand edit
-- rights to specific people, per party.
--
-- Managing the editor list stays with the creator and admins — an editor
-- cannot appoint further editors, and cannot delete the party.
-- ============================================================================

create table public.run_editors (
  run_id      uuid not null references public.runs(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  granted_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (run_id, user_id)
);

create index run_editors_user_idx on public.run_editors (user_id);

comment on table public.run_editors is
  'Extra users allowed to edit a party, beyond its creator and admins.';

-- ---------------------------------------------------------------------------
-- Who may hand out edit rights: the creator, or an admin. This is the old
-- can_edit_run() rule, kept under its own name now that editing is broader.
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_run(p_run_id uuid)
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
-- Who may edit the party's contents: the above, plus anyone granted.
-- ---------------------------------------------------------------------------
create or replace function public.can_edit_run(p_run_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select public.can_manage_run(p_run_id)
      or (
        public.has_salary_access()
        and exists (
          select 1 from public.run_editors e
          where e.run_id = p_run_id and e.user_id = auth.uid()
        )
      );
$fn$;

-- ---------------------------------------------------------------------------
-- run_editors policies.
-- ---------------------------------------------------------------------------
alter table public.run_editors enable row level security;

-- Everyone with salary access can see who is allowed to edit what — the same
-- visibility they already have over the parties themselves.
create policy "run_editors: salary reads all"
  on public.run_editors for select
  using (public.has_salary_access());

create policy "run_editors: manager grants"
  on public.run_editors for insert
  with check (public.can_manage_run(run_id));

create policy "run_editors: manager revokes"
  on public.run_editors for delete
  using (public.can_manage_run(run_id));

-- ---------------------------------------------------------------------------
-- Editing a party now goes through can_edit_run; deleting one does not.
-- Removing a party is destructive and stays with the creator and admins.
-- ---------------------------------------------------------------------------
drop policy if exists "runs: creator or admin updates" on public.runs;
drop policy if exists "runs: creator or admin deletes" on public.runs;

create policy "runs: editors update"
  on public.runs for update
  using (public.can_edit_run(id))
  with check (public.can_edit_run(id));

create policy "runs: manager deletes"
  on public.runs for delete
  using (public.can_manage_run(id));

-- run_players and loot_items already gate on can_edit_run(run_id), so they
-- pick up delegated editors without any policy change.

-- ---------------------------------------------------------------------------
-- A picker needs names, but `profiles` is readable only by its owner and by
-- admins. This exposes id + alias for salary users and nothing else, the same
-- shape of column restriction as webhook_options in 0005.
-- ---------------------------------------------------------------------------
create or replace view public.salary_users
with (security_invoker = off) as
  select id, alias
  from public.profiles
  where is_active
    and (can_access_salary or role = 'admin')
    and public.has_salary_access();

grant select on public.salary_users to authenticated;

comment on view public.salary_users is
  'id + alias of users who can reach the Salary section. No emails, no flags.';

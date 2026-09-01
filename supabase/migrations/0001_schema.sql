-- ============================================================================
-- SSQ DN Hub - schema
-- Merges: DN Tracker (per-user weekly checklist), DN Salary (shared raid loot
-- settlement), DN Calculator (client-only, deliberately no tables).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Created by trigger, never by the client.
-- can_access_salary is the single feature flag; role gates admin surfaces.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  alias              text not null,
  discord_id         text,
  role               text not null default 'member' check (role in ('admin', 'member')),
  can_access_salary  boolean not null default false,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column public.profiles.can_access_salary is
  'Single flag gating the Salary section. Enforced in RLS, not just the nav.';

-- Mirror new auth users into profiles. Alias comes from the admin-supplied
-- user_metadata at creation time, falling back to the email local-part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, alias, discord_id, role, can_access_salary)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'alias', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'discord_id', ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'member'),
    coalesce((new.raw_user_meta_data->>'can_access_salary')::boolean, false)
  );
  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Tracker - private per user. Admins get read-only access via policy.
-- ---------------------------------------------------------------------------
create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index activities_user_idx on public.activities (user_id, sort_order);

create table public.characters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  job         text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index characters_user_idx on public.characters (user_id, sort_order);

-- One row per (character, activity, week). Keyed on activity_id rather than
-- activity name, so renaming an activity no longer orphans progress - the bug
-- in the original DN Tracker.html. week_of is the Monday of the ISO week,
-- which also preserves the history the old RESET WEEKLY button destroyed.
create table public.completions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  character_id  uuid not null references public.characters(id) on delete cascade,
  activity_id   uuid not null references public.activities(id) on delete cascade,
  week_of       date not null,
  done          boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (character_id, activity_id, week_of)
);
create index completions_lookup_idx on public.completions (user_id, week_of);

-- ---------------------------------------------------------------------------
-- Salary - shared across everyone holding can_access_salary.
-- ---------------------------------------------------------------------------

-- Secret. Admin-only in RLS. The Discord send route reads it server-side with
-- the service role, so salary users can send without ever seeing the URL.
create table public.webhooks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  url         text not null,
  is_default  boolean not null default false,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- Saved players, reusable across runs (the old "Saved Users" roster).
create table public.roster_users (
  id           uuid primary key default gen_random_uuid(),
  alias        text not null,
  default_ign  text not null default '',
  discord_id   text not null default '',
  created_at   timestamptz not null default now()
);

create table public.runs (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null default 'New Party',
  ign                         text not null default '',
  created_by                  uuid references public.profiles(id) on delete set null,
  completed                   boolean not null default false,
  ss_price                    numeric(12,2) not null default 4,
  tax_per_trade               numeric(12,2) not null default 1,
  webhook_id                  uuid references public.webhooks(id) on delete set null,
  -- Not secret: drives the "Post new" vs "Update existing" button state.
  discord_thread_id           text not null default '',
  discord_initial_message_id  text not null default '',
  discord_item_message_id     text not null default '',
  created_at                  timestamptz not null default now()
);
create index runs_listing_idx on public.runs (completed, created_at desc);

create table public.run_players (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.runs(id) on delete cascade,
  roster_user_id  uuid references public.roster_users(id) on delete set null,
  name            text not null default '',
  ign             text not null default '',
  discord_id      text not null default '',
  ss_used         numeric(12,2) not null default 0,
  paid            boolean not null default false,
  sort_order      int not null default 0
);
create index run_players_run_idx on public.run_players (run_id, sort_order);

create table public.loot_items (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs(id) on delete cascade,
  name        text not null default '',
  sold_price  numeric(14,2) not null default 0,
  sold        boolean not null default false,
  sort_order  int not null default 0
);
create index loot_items_run_idx on public.loot_items (run_id, sort_order);

-- Singleton row of non-secret shared settings (the LFP invite text).
create table public.app_settings (
  id           boolean primary key default true check (id),
  lfp_message  text not null default '@here LFP GDN HC to CLASSIC PARTY UP SSQ',
  updated_at   timestamptz not null default now()
);
insert into public.app_settings (id) values (true);

-- Cap parties at 8 players, as the original app did.
create or replace function public.enforce_max_players()
returns trigger
language plpgsql
as $fn$
begin
  if (select count(*) from public.run_players where run_id = new.run_id) >= 8 then
    raise exception 'A run cannot have more than 8 players';
  end if;
  return new;
end;
$fn$;

create trigger run_players_max
  before insert on public.run_players
  for each row execute function public.enforce_max_players();

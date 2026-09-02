# SSQ DN Hub

Stream Squad's three Dragon Nest tools merged into one app behind a login.

| Section        | Who sees it              | Data                                                    |
| -------------- | ------------------------ | ------------------------------------------------------- |
| **Tracker**    | everyone                 | private per user; admins get a read-only view of anyone |
| **Calculator** | everyone                 | none — it deliberately saves nothing                    |
| **Salary**     | `can_access_salary` only | shared across everyone with the flag                    |
| **Users**      | admins only              | account creation and permission toggles                 |

Replaces `SSQ DN Tracker/DN Tracker.html`, `SSQ DN CALCULATOR/index.html` and
`SSQ DN Salary/index.html`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth + RLS) · Vitest.

## Setup

### 1. Create the Supabase project

At [supabase.com](https://supabase.com), then **Project Settings → API** for the
three keys.

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`.

> The service role key bypasses row level security completely. It is server-only
> — never prefix it with `NEXT_PUBLIC_`, never import it into a client
> component, never commit it.

### 2. Run the migrations

Paste each file into the Supabase **SQL Editor**, in order:

| File                                               | What it does                                                   |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `supabase/migrations/0001_schema.sql`              | tables, triggers, indexes                                      |
| `supabase/migrations/0002_policies.sql`            | **row level security — the actual access control**             |
| `supabase/migrations/0004_fix_privilege_guard.sql` | lets the SQL editor and service role past the privilege guard  |
| `supabase/migrations/0005_webhook_options.sql`     | name-only webhook view for the party channel picker            |
| `supabase/migrations/0006_summary_message_id.sql`  | tracks the summary message so reposting can delete the old one |
| `supabase/migrations/0003_bootstrap_admin.sql`     | promotes your first admin                                      |

> Run `0004` **before** `0003`. The privilege guard created in `0002` reverts
> changes to `role` and `can_access_salary` for any caller it can't see as an
> admin — which includes the SQL editor, where `auth.uid()` is NULL. Until
> `0004` is applied, the bootstrap update in `0003` reports success and changes
> nothing.

Or with the CLI:

```bash
npx supabase link --project-ref <your-ref> && npx supabase db push
```

### 3. Make yourself an admin

Follow the comments at the top of `0003_bootstrap_admin.sql`: create your user
in the dashboard, then run the `update` with your email. Every other account is
created from the Users page after that — there is no self-signup.

### 4. Run it

```bash
npm run dev
```

## Bringing your old data across

The old Salary app has an **Export Data (JSON)** button. Open it, export, then
in the new app go to **Salary → Import** and drop the file in. Parties, players
and loot come across.

Webhook URLs are deliberately skipped: they belong in the admin-only `webhooks`
table now. Re-add them under **Webhooks** in the nav (admins only).

The import adds rather than replaces, so running it twice creates duplicates.

## How access control actually works

Three layers, and only one of them is real:

1. **The nav** hides links you can't use. Cosmetic.
2. **Route layouts** (`salary/layout.tsx`, `lib/auth.ts`) redirect you away.
   Also cosmetic — a redirect for humans.
3. **Row level security** in `0002_policies.sql`. This is the boundary. A member
   who calls the Supabase REST API directly, or hand-edits `?user=` on the
   tracker, gets zero rows — not an error, just nothing.

Two consequences worth remembering when you extend this:

- **A new table is world-readable to any signed-in user until you write its
  policy.** `alter table … enable row level security` plus at least one policy
  is part of adding a table, not a follow-up.
- **Anything using `createAdminClient()` has no safety net.** The service role
  ignores RLS, so those routes authorise callers themselves — see the explicit
  admin check at the top of `api/admin/users/route.ts`.

### Why the helper functions are `security definer`

A policy on `characters` that subqueries `profiles` would re-enter `profiles`'
own RLS and recurse. `is_admin()`, `is_active_user()` and `has_salary_access()`
run as the function owner to break that cycle. They also set
`search_path = public`, without which a `security definer` function is a
privilege-escalation vector.

### Why Discord sends go through the server

`webhooks` is admin-only, so a salary user cannot read the URL. `POST
/api/discord/send` resolves it with the service role, posts, and returns a
status — the URL never reaches a browser, and Discord's error bodies (which can
echo the webhook token) are never forwarded to the caller.

## Performance

Every page render authenticates and then queries. Three things keep that from
adding up:

- **`requireProfile()` is wrapped in React `cache()`** — the layout needs it for
  the nav and each section gate needs it again. Without deduplication that was
  two auth calls and two profile queries per navigation, all sequential.
- **Identity comes from `getClaims()`, not `getUser()`** — `getUser()` asks the
  Auth server on every call. `getClaims()` verifies the JWT signature locally
  when the project uses asymmetric signing keys, and still refreshes an
  expiring session because it calls `getSession()` internally.
- **`vercel.json` pins the function region** to `sin1` (Singapore).

> **Set the region to match your Supabase project.** Supabase region is shown
> under Project Settings → General. If yours is not Singapore, change `sin1` in
> `vercel.json` to the matching Vercel region — `iad1` US East, `fra1`
> Frankfurt, `syd1` Sydney. Functions default to US East, so a Singapore
> database means every query crosses the Pacific twice; with six round trips per
> navigation that alone was most of the delay.

## Tests

```bash
npm test
```

Covers `src/lib/domain/money.ts` — the gold split. That is the only code here
that decides how much a real person is owed, including the floor-rounding
behaviour inherited from the original app, so it is the part that gets tests.

## Notes on behaviour that changed

- **Weekly reset no longer destroys history.** Completions are keyed by
  `week_of`, so moving to a new week leaves last week's intact. The old
  `RESET WEEKLY` button wiped everything permanently.
- **Renaming an activity keeps its progress.** Completions key on activity `id`,
  not name — the original keyed on name, so a rename orphaned every tick.
- **Rounding residue is shown.** Flooring the even share can leave a few gold
  unallocated; the run page now reports it instead of dropping it silently.

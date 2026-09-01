-- ============================================================================
-- A name-only view of webhooks, so a party can be pointed at a channel without
-- exposing the URL.
--
-- RLS is row-level, not column-level: any policy that let salary users read a
-- webhook row would hand them the `url` too. A view is the right tool for a
-- column restriction.
--
-- `security_invoker = off` (the default) means this runs as the view owner and
-- therefore bypasses RLS on `webhooks` — which is exactly what we want here,
-- because the view selects no secret columns. The salary gate is written into
-- the view body instead, so it still can't be read by someone without access.
-- ============================================================================

create or replace view public.webhook_options
with (security_invoker = off) as
  select id, name, is_default
  from public.webhooks
  where public.has_salary_access();

grant select on public.webhook_options to authenticated;

comment on view public.webhook_options is
  'Webhook id + name for pickers. Deliberately omits url — see 0005.';

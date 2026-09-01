-- ============================================================================
-- Track the summary message the same way the roster and loot messages are
-- tracked, so re-sending the summary can delete the previous copy.
--
-- Like the loot update, the summary reposts at the bottom of the thread rather
-- than editing in place: an edited message stays wherever it first landed,
-- which is buried once the thread has any discussion under it.
-- ============================================================================

alter table public.runs
  add column if not exists discord_summary_message_id text not null default '';

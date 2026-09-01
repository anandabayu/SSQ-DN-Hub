import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Run } from "@/lib/domain/database.types";
import {
  buildItemUpdateMessage,
  buildRosterMessage,
  buildSummaryEmbed,
  buildThreadName,
} from "@/lib/domain/discord";
import {
  deleteMessage,
  describeError,
  patchMessage,
  postMessage,
  type SendResult,
} from "@/lib/domain/discord-transport";

const SendSchema = z.object({
  runId: z.uuid(),
  kind: z.enum(["roster", "items", "summary", "test"]),
});

type SendKind = z.infer<typeof SendSchema>["kind"];

/** Where each kind's last message id is remembered. `test` is never tracked. */
const MESSAGE_ID_COLUMN: Record<
  SendKind,
  keyof Pick<
    Run,
    | "discord_initial_message_id"
    | "discord_item_message_id"
    | "discord_summary_message_id"
  > | null
> = {
  roster: "discord_initial_message_id",
  items: "discord_item_message_id",
  summary: "discord_summary_message_id",
  test: null,
};

/**
 * Kinds that repost at the bottom of the thread and delete their previous
 * copy, rather than editing in place. The roster is deliberately excluded — it
 * is a stable reference the thread is anchored on.
 */
const REPOSTING_KINDS: ReadonlySet<SendKind> = new Set<SendKind>([
  "items",
  "summary",
]);

/**
 * Posts to Discord on behalf of a salary user.
 *
 * The whole point of this route: `webhooks` is admin-only in RLS, so a salary
 * user cannot read the URL. The send happens here instead — the URL is
 * resolved with the service role, used, and never included in the response.
 *
 * Anything returned from this handler is visible to the caller, so it returns
 * a status and nothing else.
 */

// Crude in-process limiter: enough to stop a stuck button spamming the guild
// channel. Resets on deploy, and is per-instance rather than global — swap for
// Upstash or a Postgres counter if this ever needs to be authoritative.
const lastSendByUser = new Map<string, number>();
const MIN_INTERVAL_MS = 3000;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // has_salary_access() is the same function the RLS policies use, so this
  // check and the database agree by construction.
  const { data: allowed } = await supabase.rpc("has_salary_access");
  if (!allowed) {
    return NextResponse.json({ error: "No salary access." }, { status: 403 });
  }

  const now = Date.now();
  const last = lastSendByUser.get(user.id) ?? 0;
  if (now - last < MIN_INTERVAL_MS) {
    return NextResponse.json(
      { error: "Slow down — wait a moment before sending again." },
      { status: 429 },
    );
  }

  const parsed = SendSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { runId, kind } = parsed.data;

  // Read run data through the RLS client: if the caller somehow shouldn't see
  // this run, they get nothing here rather than leaking it into Discord.
  const [{ data: run }, { data: players }, { data: items }] = await Promise.all([
    supabase.from("runs").select("*").eq("id", runId).single(),
    supabase.from("run_players").select("*").eq("run_id", runId).order("sort_order"),
    supabase.from("loot_items").select("*").eq("run_id", runId).order("sort_order"),
  ]);

  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  // Service role from here: webhooks is admin-only, and the caller may not be
  // an admin.
  const admin = createAdminClient();

  const { data: webhook } = run.webhook_id
    ? await admin.from("webhooks").select("url").eq("id", run.webhook_id).single()
    : await admin.from("webhooks").select("url").eq("is_default", true).limit(1).single();

  if (!webhook?.url) {
    return NextResponse.json(
      { error: "No Discord webhook configured. Ask an admin to add one." },
      { status: 400 },
    );
  }

  const runPlayers = players ?? [];
  const runItems = items ?? [];

  const payload =
    kind === "roster"
      ? buildRosterMessage(run, runPlayers, runItems)
      : kind === "items"
        ? buildItemUpdateMessage(run, runPlayers, runItems)
        : kind === "summary"
          ? buildSummaryEmbed(run, runPlayers, runItems)
          : { content: "✅ SSQ DN Hub — webhook connection test successful." };

  const threadId = run.discord_thread_id || undefined;

  const previousMessageId = MESSAGE_ID_COLUMN[kind]
    ? run[MESSAGE_ID_COLUMN[kind]]
    : "";

  // The roster is a stable reference near the top of the thread, so re-sending
  // edits it in place.
  //
  // The loot update and summary are not: an edited message stays wherever it
  // first landed, which is buried once the thread has discussion under it.
  // Those repost at the bottom, and the previous copy is deleted below —
  // newest state last, no duplicates.
  const editInPlace = !REPOSTING_KINDS.has(kind) && Boolean(previousMessageId);
  const staleMessageId = REPOSTING_KINDS.has(kind) ? previousMessageId : "";

  let result: SendResult;
  try {
    result =
      editInPlace && threadId && previousMessageId
        ? await patchMessage(webhook.url, previousMessageId, payload, threadId)
        : await postMessage(webhook.url, payload, {
            threadId,
            // Names the forum thread if the channel turns out to need one.
            threadName: buildThreadName(run),
          });
  } catch (cause) {
    console.error("[discord] unreachable", { runId, kind, cause });
    return NextResponse.json(
      { error: "Could not reach Discord." },
      { status: 502 },
    );
  }

  if (!result.ok) {
    console.error("[discord] send rejected", {
      runId,
      kind,
      status: result.status,
      detail: result.detail,
      // The payload, never the URL.
      payload,
    });

    return NextResponse.json(
      {
        error: `Discord rejected the message (${result.status})${describeError(result.detail)}`,
      },
      { status: 502 },
    );
  }

  lastSendByUser.set(user.id, now);

  // The new copy is posted before the old one is removed. If the delete fails
  // you get a duplicate — annoying but recoverable. Deleting first and then
  // failing to post would lose the update entirely.
  let replacedOld = false;
  if (staleMessageId) {
    replacedOld = await deleteMessage(
      webhook.url,
      staleMessageId,
      result.message.channel_id || threadId,
    );

    if (!replacedOld) {
      console.warn("[discord] could not delete previous message", {
        runId,
        kind,
        messageId: staleMessageId,
      });
    }
  }

  const patch: Partial<Run> = {};

  // A forum post lands in a thread Discord just created — the returned
  // message's channel_id *is* that thread. Save it so every later send
  // (loot update, summary) goes to the same place.
  if (result.createdThread && result.message.channel_id) {
    patch.discord_thread_id = result.message.channel_id;
  }

  const column = MESSAGE_ID_COLUMN[kind];
  if (result.message.id && column) {
    patch[column] = result.message.id;
  }

  if (Object.keys(patch).length > 0) {
    await supabase.from("runs").update(patch).eq("id", runId);
  }

  return NextResponse.json({
    ok: true,
    createdThread: result.createdThread,
    edited: editInPlace,
    replacedOld,
  });
}

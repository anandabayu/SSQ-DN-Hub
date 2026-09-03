"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Input, Select } from "@/components/ui";
import type { Run, WebhookOption } from "@/lib/domain/database.types";

import { updateRun } from "../actions";

type Kind = "roster" | "items" | "summary" | "test";

/**
 * No webhook URL field here — that lives on the admin Users/Settings side.
 * These buttons hit /api/discord/send, which resolves the URL server-side, so
 * nothing secret is ever loaded into this component.
 */
export function DiscordPanel({
  run,
  channels,
  readOnly,
}: {
  run: Run;
  channels: WebhookOption[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [threadId, setThreadId] = useState(run.discord_thread_id);

  // Once a message exists in the thread, re-sending edits it in place.
  const rosterPosted = Boolean(
    run.discord_initial_message_id && run.discord_thread_id,
  );
  const lootPosted = Boolean(
    run.discord_item_message_id && run.discord_thread_id,
  );
  const summaryPosted = Boolean(
    run.discord_summary_message_id && run.discord_thread_id,
  );
  const [busy, setBusy] = useState<Kind | null>(null);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  async function send(kind: Kind) {
    setBusy(kind);
    setMessage(null);

    const response = await fetch("/api/discord/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id, kind }),
    });

    const body = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Send failed." });
      return;
    }

    setMessage({
      tone: "ok",
      text: body.createdThread
        ? "Thread created on Discord — later updates post into it."
        : body.edited
          ? "Updated the roster message in place."
          : body.replacedOld
            ? "Reposted at the bottom of the thread; the old one was removed."
            : "Sent to Discord.",
    });

    // A newly created thread id is written server-side; pull it into the page.
    router.refresh();
  }

  // Sending writes the thread and message ids back onto the party, so it is an
  // edit like any other — a read-only viewer gets nothing here.
  if (readOnly) {
    return (
      <Card title="Discord">
        <p className="text-sm text-fg-dim">
          Only the party&apos;s creator or an admin can post this party to
          Discord.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Discord">
      <div className="space-y-3">
        {/* Names come from the `webhook_options` view, which omits the URL —
            picking a channel never puts a secret in the browser. */}
        <label className="flex flex-wrap items-center gap-2 text-sm text-fg-dim">
          Channel
          <Select
            value={run.webhook_id ?? ""}
            onChange={(e) =>
              startTransition(() => {
                void updateRun(run.id, { webhook_id: e.target.value || null });
              })
            }
          >
            <option value="">
              {channels.find((c) => c.is_default)
                ? `Default (${channels.find((c) => c.is_default)!.name})`
                : "Default"}
            </option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-wrap items-center gap-2 text-sm text-fg-dim">
          Thread ID (optional)
          <Input
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
            onBlur={() =>
              threadId !== run.discord_thread_id &&
              startTransition(() => {
                void updateRun(run.id, { discord_thread_id: threadId });
              })
            }
            placeholder="Post into an existing thread"
            className="w-full sm:w-64"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send("roster")} disabled={busy !== null}>
            {busy === "roster"
              ? "Sending…"
              : rosterPosted
                ? "Update Roster"
                : "Send Roster"}
          </Button>
          <Button onClick={() => send("items")} disabled={busy !== null}>
            {busy === "items"
              ? "Sending…"
              : lootPosted
                ? "Repost Loot Update"
                : "Send Loot Update"}
          </Button>
          <Button
            variant="primary"
            onClick={() => send("summary")}
            disabled={busy !== null}
          >
            {busy === "summary"
              ? "Sending…"
              : summaryPosted
                ? "Repost Summary"
                : "Send Summary"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => send("test")}
            disabled={busy !== null}
          >
            Test
          </Button>
        </div>

        {message && (
          <p
            className={`text-sm ${message.tone === "ok" ? "text-success" : "text-danger"}`}
            role="status"
          >
            {message.text}
          </p>
        )}

        <p className="text-xs text-fg-dim">
          {run.discord_thread_id
            ? "Posting into this party's thread. The roster message is edited in place; loot updates and the summary repost at the bottom, and their previous copy is deleted."
            : "Send Roster first — on a forum channel that creates the thread, and everything after posts into it."}{" "}
          The webhook URL is stored admin-only and never sent to your browser.
        </p>
      </div>
    </Card>
  );
}

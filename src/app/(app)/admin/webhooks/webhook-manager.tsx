"use client";

import { useState, useTransition } from "react";

import { Button, Card, EmptyState, Input } from "@/components/ui";
import type { Webhook } from "@/lib/domain/database.types";

import {
  addWebhook,
  deleteWebhook,
  setDefaultWebhook,
  updateWebhook,
} from "./actions";

/**
 * Shows `https://discord.com/api/webhooks/123…wxyz` rather than the full URL.
 * You already know your own webhook; this just keeps it off screen during
 * screen shares.
 */
function maskUrl(url: string): string {
  const token = url.split("/webhooks/")[1] ?? "";
  if (token.length <= 12) return "https://discord.com/api/webhooks/…";
  return `https://discord.com/api/webhooks/${token.slice(0, 4)}…${token.slice(-4)}`;
}

function WebhookRow({ webhook }: { webhook: Webhook }) {
  const [, startTransition] = useTransition();
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-lg border border-line bg-panel-2/40 p-3">
      <form
        action={(formData) =>
          startTransition(async () => {
            setError(null);
            const result = await updateWebhook(formData);
            if (result?.error) setError(result.error);
          })
        }
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={webhook.id} />

        <Input
          name="name"
          defaultValue={webhook.name}
          maxLength={40}
          required
          className="min-w-0 flex-1"
          aria-label="Webhook name"
        />

        <Input
          name="url"
          type={revealed ? "text" : "password"}
          defaultValue={revealed ? webhook.url : ""}
          placeholder={revealed ? undefined : "Leave blank to keep current URL"}
          className="min-w-0 flex-[2] font-mono text-xs"
          aria-label="Webhook URL"
        />

        <Button
          type="button"
          variant="ghost"
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? "Hide" : "Show"}
        </Button>

        <Button type="submit">Save</Button>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {!revealed && (
          <span className="font-mono text-fg-dim">{maskUrl(webhook.url)}</span>
        )}

        {webhook.is_default ? (
          <span className="rounded border border-gold/40 bg-gold/10 px-2 py-0.5 text-gold">
            default
          </span>
        ) : (
          <form action={setDefaultWebhook}>
            <input type="hidden" name="id" value={webhook.id} />
            <button
              type="submit"
              className="cursor-pointer text-fg-dim underline-offset-2 hover:text-gold hover:underline"
            >
              Make default
            </button>
          </form>
        )}

        <form
          action={deleteWebhook}
          onSubmit={(e) => {
            if (!confirm(`Delete the "${webhook.name}" webhook?`)) {
              e.preventDefault();
            }
          }}
          className="ml-auto"
        >
          <input type="hidden" name="id" value={webhook.id} />
          <button
            type="submit"
            className="cursor-pointer text-fg-dim underline-offset-2 hover:text-danger hover:underline"
          >
            Delete
          </button>
        </form>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function WebhookManager({ webhooks }: { webhooks: Webhook[] }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card title="Add Webhook">
        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await addWebhook(formData);
              if (result?.error) setError(result.error);
            })
          }
          className="space-y-3"
        >
          <div className="flex flex-wrap gap-2">
            <Input
              name="name"
              placeholder="Channel name (e.g. Main channel)"
              maxLength={40}
              required
              className="min-w-0 flex-1"
            />
            <Input
              name="url"
              type="password"
              placeholder="https://discord.com/api/webhooks/…"
              required
              className="min-w-0 flex-[2] font-mono text-xs"
            />
            <Button type="submit" variant="primary">
              + Add
            </Button>
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs text-fg-dim">
            Discord: <strong>Server Settings → Integrations → Webhooks →
            New Webhook → Copy Webhook URL</strong>. Anyone holding this URL can
            post to that channel, so treat it like a password.
          </p>
        </form>
      </Card>

      <Card title={`Configured (${webhooks.length})`}>
        {webhooks.length === 0 ? (
          <EmptyState>
            No webhooks yet. Sending from a party will fail until one is added.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <WebhookRow key={webhook.id} webhook={webhook} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

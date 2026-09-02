"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Input } from "@/components/ui";
import type { Profile } from "@/lib/domain/database.types";

/**
 * Per-row account actions: change the sign-in email, set a new password, or
 * delete the account outright.
 *
 * All three touch `auth.users`, which only the service role can write, so they
 * go through /api/admin/users/[userId] rather than a server action.
 */
export function UserAccountActions({
  profile,
  email,
  isSelf,
}: {
  profile: Profile;
  email: string | null;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const emailValue = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const body: { email?: string; password?: string } = {};
    // Only send what actually changed — a blank field means "leave alone",
    // so clearing the password box can never wipe someone's login.
    if (emailValue && emailValue !== email) body.email = emailValue;
    if (password) body.password = password;

    if (!body.email && !body.password) {
      setMessage({ tone: "error", text: "Nothing changed." });
      return;
    }

    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/admin/users/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage({ tone: "error", text: result.error ?? "Update failed." });
      return;
    }

    form.reset();
    setMessage({ tone: "ok", text: "Saved." });
    router.refresh();
  }

  async function remove() {
    const confirmed = confirm(
      `Delete ${profile.alias}?\n\n` +
        "This permanently removes their account and their entire tracker — " +
        "characters, activities and every week of progress.\n\n" +
        "Parties they created are kept.\n\n" +
        "To block access without losing data, set them to disabled instead.",
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/admin/users/${profile.id}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage({ tone: "error", text: result.error ?? "Delete failed." });
      return;
    }

    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title="Change email or password"
          className="cursor-pointer rounded px-2 py-1 text-fg-dim transition-colors hover:bg-accent/15 hover:text-accent"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={remove}
          disabled={busy || isSelf}
          title={
            isSelf ? "You cannot delete your own account" : `Delete ${profile.alias}`
          }
          className="cursor-pointer rounded px-2 py-1 text-fg-dim transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
        >
          &times;
        </button>
      </div>

      {open && (
        <form
          onSubmit={submit}
          className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-line bg-panel-2/40 p-2"
        >
          <Input
            name="email"
            type="email"
            defaultValue={email ?? ""}
            placeholder="Sign-in email"
            className="w-52"
            aria-label={`Email for ${profile.alias}`}
          />
          <Input
            name="password"
            type="text"
            placeholder="New password (blank = keep)"
            minLength={8}
            className="w-56"
            aria-label={`New password for ${profile.alias}`}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      )}

      {message && (
        <p
          className={`mt-1 text-right text-xs ${
            message.tone === "ok" ? "text-success" : "text-danger"
          }`}
          role="status"
        >
          {message.text}
        </p>
      )}
    </>
  );
}

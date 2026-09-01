"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";

export function CreateUserForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? ""),
        alias: String(data.get("alias") ?? "").trim(),
        discordId: String(data.get("discordId") ?? "").trim(),
        role: "member",
        canAccessSalary: data.get("canAccessSalary") === "on",
      }),
    });

    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not create that user.");
      return;
    }

    form.reset();
    setOk("User created. Share the password with them directly.");
    router.refresh();
  }

  return (
    <Card title="Create User">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="alias" placeholder="Alias" maxLength={30} required />
          <Input
            name="discordId"
            placeholder="Discord user ID (optional)"
            maxLength={24}
          />
          <Input name="email" type="email" placeholder="Email" required />
          <Input
            name="password"
            type="text"
            placeholder="Temporary password (min 8 chars)"
            minLength={8}
            required
          />
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-fg-dim">
          <input
            type="checkbox"
            name="canAccessSalary"
            className="size-4 accent-[#8b6fe0]"
          />
          Grant Salary access
        </label>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {ok && <p className="text-sm text-success">{ok}</p>}

        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Creating…" : "Create User"}
        </Button>
      </form>
    </Card>
  );
}

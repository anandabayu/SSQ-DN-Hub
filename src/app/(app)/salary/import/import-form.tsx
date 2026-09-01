"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card } from "@/components/ui";

export function ImportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setResult(null);

    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      setBusy(false);
      setResult({ tone: "error", text: "That file isn't valid JSON." });
      return;
    }

    const response = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    setBusy(false);
    event.target.value = "";

    if (!response.ok) {
      setResult({ tone: "error", text: body.error ?? "Import failed." });
      return;
    }

    setResult({
      tone: "ok",
      text: `Imported ${body.importedRuns} parties and ${body.importedRoster} saved users.`,
    });
    router.refresh();
  }

  return (
    <Card>
      <div className="space-y-3">
        <label className="flex w-fit cursor-pointer items-center gap-2">
          <input
            type="file"
            accept="application/json"
            onChange={onFile}
            disabled={busy}
            className="text-sm text-fg-dim file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-panel-2 file:px-3 file:py-2 file:text-sm file:text-fg hover:file:border-gold"
          />
        </label>

        {busy && <p className="text-sm text-fg-dim">Importing…</p>}

        {result && (
          <p
            className={`text-sm ${result.tone === "ok" ? "text-success" : "text-danger"}`}
            role="status"
          >
            {result.text}
          </p>
        )}

        <p className="text-xs text-fg-dim">
          Running this twice will create duplicate parties — it adds, it never
          replaces.
        </p>

        <Button variant="ghost" onClick={() => router.push("/salary")}>
          Done
        </Button>
      </div>
    </Card>
  );
}

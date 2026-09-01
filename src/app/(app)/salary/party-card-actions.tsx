"use client";

import { copyRun, deleteRun } from "./actions";

/**
 * The corner controls the original party cards had: delete (×) and copy (⧉).
 *
 * Rendered above the card's stretched link, so clicking one doesn't also open
 * the party — the original had to call stopPropagation for the same reason.
 */
export function PartyCardActions({
  runId,
  runName,
}: {
  runId: string;
  runName: string;
}) {
  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      <form action={copyRun}>
        <input type="hidden" name="runId" value={runId} />
        <button
          type="submit"
          title="Copy party (players only, no loot)"
          aria-label={`Copy ${runName}`}
          className="cursor-pointer rounded px-1.5 py-0.5 text-sm text-fg-dim/60 transition-colors hover:bg-accent/15 hover:text-accent"
        >
          ⧉
        </button>
      </form>

      <form
        action={deleteRun}
        onSubmit={(e) => {
          if (!confirm(`Delete party "${runName}"? This cannot be undone.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="runId" value={runId} />
        <button
          type="submit"
          title="Delete party"
          aria-label={`Delete ${runName}`}
          className="cursor-pointer rounded px-1.5 py-0.5 text-sm text-fg-dim/60 transition-colors hover:bg-danger/10 hover:text-danger"
        >
          &times;
        </button>
      </form>
    </div>
  );
}

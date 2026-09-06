"use client";

import { useState, useTransition } from "react";

import { Button, EmptyState, Select } from "@/components/ui";
import { Modal } from "@/components/modal";
import type { SalaryUser } from "@/lib/domain/database.types";

import { addRunEditor, removeRunEditor } from "../actions";

/**
 * Who can edit this party, beyond its creator and admins.
 *
 * The party's creator is not always the person holding the loot — an admin
 * often sets the party up and someone else ticks items off as they sell. This
 * is how that person gets write access without being made an admin.
 *
 * Everyone with salary access can see the list; only the creator or an admin
 * can change it.
 */
export function EditorsModal({
  runId,
  creatorAlias,
  editors,
  candidates,
  canManage,
}: {
  runId: string;
  creatorAlias: string | null;
  /** Users currently granted edit rights. */
  editors: SalaryUser[];
  /** Everyone who could be granted them. */
  candidates: SalaryUser[];
  canManage: boolean;
}) {
  return (
    <Modal
      title="Who can edit this party"
      trigger={
        <Button variant="ghost">
          Editors{editors.length > 0 ? ` (${editors.length})` : ""}
        </Button>
      }
    >
      <EditorsManager
        runId={runId}
        creatorAlias={creatorAlias}
        editors={editors}
        candidates={candidates}
        canManage={canManage}
      />
    </Modal>
  );
}

function EditorsManager({
  runId,
  creatorAlias,
  editors,
  candidates,
  canManage,
}: {
  runId: string;
  creatorAlias: string | null;
  editors: SalaryUser[];
  candidates: SalaryUser[];
  canManage: boolean;
}) {
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  const granted = new Set(editors.map((e) => e.id));
  const addable = candidates.filter((c) => !granted.has(c.id));

  function add() {
    if (!selected) return;
    setError(null);
    const userId = selected;
    setSelected("");

    startTransition(async () => {
      const result = await addRunEditor(runId, userId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-dim">
        Editors can change players, loot and party settings, and post to
        Discord. They cannot delete the party or change this list — that stays
        with {creatorAlias ? <strong>{creatorAlias}</strong> : "the creator"} and
        admins.
      </p>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-0 flex-1"
            aria-label="User to grant edit rights"
          >
            <option value="">Choose someone…</option>
            {addable.map((user) => (
              <option key={user.id} value={user.id}>
                {user.alias}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={add} disabled={!selected}>
            + Add Editor
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {editors.length === 0 ? (
        <EmptyState>
          {canManage
            ? "No extra editors. Add the person handling the loot so they can tick items off."
            : "No extra editors on this party."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {editors.map((editor) => (
            <li
              key={editor.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span>{editor.alias}</span>
              {canManage && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => {
                      void removeRunEditor(runId, editor.id);
                    })
                  }
                  aria-label={`Remove ${editor.alias} as an editor`}
                  className="cursor-pointer rounded px-2 py-1 text-fg-dim transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && addable.length === 0 && editors.length > 0 && (
        <p className="text-xs text-fg-dim">
          Everyone with salary access already has edit rights on this party.
        </p>
      )}
    </div>
  );
}

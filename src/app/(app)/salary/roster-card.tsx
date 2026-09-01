"use client";

import { useTransition } from "react";

import { Button, EmptyState, Input } from "@/components/ui";
import { Modal } from "@/components/modal";
import type { RosterUser } from "@/lib/domain/database.types";

import { addRosterUser, deleteRosterUser, updateRosterUser } from "./actions";

/**
 * Saved users — Dragon Nest players, not app accounts.
 *
 * Add someone once and they can be quick-picked into any party, so a Discord
 * ID gets typed exactly once rather than every run. Nobody in this list needs
 * a login.
 *
 * Lives in a modal so a long roster doesn't push the party list off screen.
 */
export function RosterModal({ roster }: { roster: RosterUser[] }) {
  return (
    <Modal
      title={`Saved Users (${roster.length})`}
      trigger={<Button>Saved Users ({roster.length})</Button>}
    >
      <RosterManager roster={roster} />
    </Modal>
  );
}

function RosterManager({ roster }: { roster: RosterUser[] }) {
  const [, startTransition] = useTransition();

  const save = (id: string, patch: Partial<RosterUser>) =>
    startTransition(() => {
      void updateRosterUser(id, patch);
    });

  return (
    <div className="space-y-3">
      <form action={addRosterUser} className="flex flex-wrap gap-2">
        <Input
          name="alias"
          placeholder="Alias"
          maxLength={30}
          required
          className="min-w-0 flex-1"
        />
        <Input
          name="default_ign"
          placeholder="Default IGN"
          maxLength={30}
          className="min-w-0 flex-1"
        />
        <Input
          name="discord_id"
          placeholder="Discord user ID"
          maxLength={24}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary">
          + Add
        </Button>
      </form>

      {roster.length === 0 ? (
        <EmptyState>
          No saved users yet. Add players here once, then quick-pick them in any
          party instead of retyping their Discord ID.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-xs tracking-wider text-fg-dim uppercase">
                <th className="pb-2 text-left font-semibold">Alias</th>
                <th className="pb-2 text-left font-semibold">Default IGN</th>
                <th className="pb-2 text-left font-semibold">Discord ID</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {roster.map((entry) => (
                <tr key={entry.id} className="border-t border-line transition-colors hover:bg-panel-2/60">
                  <td className="py-1 pr-2">
                    <Input
                      defaultValue={entry.alias}
                      maxLength={30}
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== entry.alias &&
                        save(entry.id, { alias: e.target.value.trim() })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      defaultValue={entry.default_ign}
                      placeholder="—"
                      maxLength={30}
                      onBlur={(e) =>
                        e.target.value !== entry.default_ign &&
                        save(entry.id, { default_ign: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      defaultValue={entry.discord_id}
                      placeholder="—"
                      maxLength={24}
                      onBlur={(e) =>
                        e.target.value !== entry.discord_id &&
                        save(entry.id, { discord_id: e.target.value })
                      }
                    />
                  </td>
                  <td className="py-1 text-center">
                    <form
                      action={deleteRosterUser}
                      onSubmit={(e) => {
                        if (!confirm(`Remove ${entry.alias} from saved users?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={entry.id} />
                      <button
                        type="submit"
                        aria-label={`Remove ${entry.alias}`}
                        className="cursor-pointer rounded px-2 py-1 text-fg-dim hover:bg-danger/10 hover:text-danger"
                      >
                        &times;
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-fg-dim">
        These are in-game players, not app accounts. They don&apos;t log in —
        manage logins under <strong>Users</strong>.
      </p>
    </div>
  );
}

"use client";

import { useOptimistic, useState, useTransition } from "react";

import { Button, EmptyState, Input } from "@/components/ui";
import {
  computePlayerPayout,
  formatGold,
  type RunSettings,
  type RunTotals,
} from "@/lib/domain/money";
import type { RosterUser, RunPlayer } from "@/lib/domain/database.types";

import {
  addPlayer,
  removePlayer,
  reorderPlayers,
  savePlayerToRoster,
  updatePlayer,
} from "../actions";
import {
  applyMove,
  DragHandle,
  type Move,
} from "@/components/drag-handle";

export function PlayersTable({
  runId,
  players,
  roster,
  settings,
  totals,
  readOnly,
}: {
  runId: string;
  players: RunPlayer[];
  roster: RosterUser[];
  settings: RunSettings;
  totals: RunTotals;
  readOnly: boolean;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [ign, setIgn] = useState("");

  const [shown, movePlayer] = useOptimistic<RunPlayer[], Move>(
    players,
    applyMove,
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function drop(to: number) {
    if (dragIndex === null || dragIndex === to) return;
    const from = dragIndex;
    setDragIndex(null);

    startTransition(async () => {
      movePlayer({ from, to });
      await reorderPlayers(runId, applyMove(shown, { from, to }).map((p) => p.id));
    });
  }

  const save = (playerId: string, patch: Partial<RunPlayer>) =>
    startTransition(() => {
      void updatePlayer(runId, playerId, patch);
    });

  function onAdd() {
    setError(null);
    const pending = { alias, ign };
    setAlias("");
    setIgn("");

    startTransition(async () => {
      const result = await addPlayer(runId, pending);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {players.length === 0 ? (
        <EmptyState>No players yet.</EmptyState>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-xs tracking-wider text-fg-dim uppercase">
                <th className="w-7" />
                <th className="pb-2 text-left font-semibold">Name</th>
                <th className="pb-2 text-left font-semibold">IGN</th>
                <th className="pb-2 text-left font-semibold">Discord ID</th>
                <th className="w-20 pb-2 text-right font-semibold">SS</th>
                <th className="w-24 pb-2 text-right font-semibold">Reimb.</th>
                <th className="w-28 pb-2 text-right font-semibold">Payout</th>
                <th className="w-20 pb-2 text-center font-semibold">Paid</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {shown.map((player, index) => {
                const payout = computePlayerPayout(
                  settings,
                  { ssUsed: Number(player.ss_used), paid: player.paid },
                  totals,
                );

                return (
                  <tr
                    key={player.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => drop(index)}
                    className={[
                      "border-t border-line transition-colors",
                      // Settled players recede so the ones still owed gold
                      // stand out at a glance.
                      player.paid
                        ? "bg-success/8 hover:bg-success/15"
                        : "hover:bg-panel-2/60",
                      dragIndex === index && "opacity-40",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {readOnly ? (
                      <td className="w-7" />
                    ) : (
                      <DragHandle
                        onDragStart={() => setDragIndex(index)}
                        onDragEnd={() => setDragIndex(null)}
                        label={`Reorder ${player.name || "player"}`}
                      />
                    )}
                    <td className="py-1 pr-2">
                      <Input
                        defaultValue={player.name}
                        placeholder="Player"
                        maxLength={30}
                        disabled={readOnly}
                        onBlur={(e) =>
                          e.target.value !== player.name &&
                          save(player.id, { name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        defaultValue={player.ign}
                        placeholder="IGN"
                        maxLength={30}
                        disabled={readOnly}
                        onBlur={(e) =>
                          e.target.value !== player.ign &&
                          save(player.id, { ign: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        defaultValue={player.discord_id}
                        placeholder="Discord ID"
                        maxLength={24}
                        disabled={readOnly}
                        onBlur={(e) =>
                          e.target.value !== player.discord_id &&
                          save(player.id, { discord_id: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        className="tabular text-right"
                        defaultValue={String(player.ss_used)}
                        disabled={readOnly}
                        onBlur={(e) =>
                          Number(e.target.value) !== Number(player.ss_used) &&
                          save(player.id, { ss_used: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="tabular px-1 py-1 text-right text-fg-dim">
                      {formatGold(payout.reimb)}
                    </td>
                    <td className="tabular px-1 py-1 text-right font-semibold text-gold">
                      {formatGold(payout.finalTotal)}
                    </td>
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={player.paid}
                        disabled={readOnly}
                        onChange={(e) =>
                          save(player.id, { paid: e.target.checked })
                        }
                        aria-label={`${player.name || "Player"} paid`}
                        className="size-4 cursor-pointer accent-[#5ecb8a] disabled:cursor-default"
                      />
                    </td>
                    <td className="py-1 text-center whitespace-nowrap">
                      {/* Only for ad-hoc players: someone already linked to a
                          saved user has nothing to save. */}
                      {!readOnly && !player.roster_user_id && player.name.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            startTransition(async () => {
                              const result = await savePlayerToRoster(
                                runId,
                                player.id,
                              );
                              if (result?.error) setError(result.error);
                            });
                          }}
                          title={`Save ${player.name} to Saved Users`}
                          aria-label={`Save ${player.name} to saved users`}
                          className="cursor-pointer rounded px-2 py-1 text-fg-dim hover:bg-accent/15 hover:text-accent"
                        >
                          ★
                        </button>
                      )}
                      {player.roster_user_id && (
                        <span
                          title="Saved user"
                          aria-label="Saved user"
                          className="px-2 py-1 text-success"
                        >
                          ★
                        </span>
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(() => {
                              void removePlayer(runId, player.id);
                            })
                          }
                          aria-label={`Remove ${player.name || "player"}`}
                          className="cursor-pointer rounded px-2 py-1 text-fg-dim hover:bg-danger/10 hover:text-danger"
                        >
                          &times;
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Quick-pick from saved users. Typing a saved alias pulls their Discord
          ID and default IGN across; an unknown name is added as-is, so ad-hoc
          players don't have to be saved first. */}
      <div className={`flex flex-wrap gap-2 ${readOnly ? "hidden" : ""}`}>
        <Input
          list="roster-options"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="+ New player (search saved users…)"
          maxLength={30}
          className="min-w-0 flex-1"
          aria-label="Player name or saved user"
        />
        <datalist id="roster-options">
          {roster.map((entry) => (
            <option key={entry.id} value={entry.alias}>
              {entry.default_ign || entry.discord_id || ""}
            </option>
          ))}
        </datalist>

        <Input
          value={ign}
          onChange={(e) => setIgn(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="IGN for this run (optional)"
          maxLength={30}
          className="min-w-0 flex-1"
          aria-label="IGN for this run"
        />

        <Button onClick={onAdd} disabled={players.length >= 8}>
          + Add Player
        </Button>
      </div>

      {!readOnly && players.length >= 8 && (
        <p className="text-xs text-fg-dim">Party is full at 8 players.</p>
      )}
    </div>
  );
}

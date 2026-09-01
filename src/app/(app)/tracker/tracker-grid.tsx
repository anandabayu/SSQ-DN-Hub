"use client";

import { useOptimistic, useState, useTransition } from "react";

import type { Activity, Character } from "@/lib/domain/database.types";
import {
  deleteActivity,
  deleteCharacter,
  reorderActivities,
  reorderCharacters,
  setCompletion,
} from "./actions";

const key = (characterId: string, activityId: string) =>
  `${characterId}:${activityId}`;

interface Move {
  from: number;
  to: number;
}

function applyMove<T>(list: T[], { from, to }: Move): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Character rows x activity columns, the same shape as the original tracker.
 *
 * Completion is keyed on activity *id*, not name — renaming an activity used
 * to orphan every tick against it.
 *
 * Drag a column header to reorder activities, a character name to reorder
 * rows. Both are optimistic so the grid moves under the cursor rather than
 * after a round trip.
 */
export function TrackerGrid({
  characters,
  activities,
  doneKeys,
  week,
  readOnly,
}: {
  characters: Character[];
  activities: Activity[];
  doneKeys: string[];
  week: string;
  readOnly: boolean;
}) {
  const [, startTransition] = useTransition();

  const [done, toggleOptimistic] = useOptimistic(
    new Set(doneKeys),
    (current: Set<string>, k: string) => {
      const next = new Set(current);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    },
  );

  const [shownActivities, moveActivity] = useOptimistic<Activity[], Move>(
    activities,
    applyMove,
  );
  const [shownCharacters, moveCharacter] = useOptimistic<Character[], Move>(
    characters,
    applyMove,
  );

  // Crosshair highlight, as the original had.
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  const [dragActivity, setDragActivity] = useState<number | null>(null);
  const [dragCharacter, setDragCharacter] = useState<number | null>(null);

  function toggle(characterId: string, activityId: string) {
    if (readOnly) return;

    const k = key(characterId, activityId);
    const nextDone = !done.has(k);

    startTransition(async () => {
      toggleOptimistic(k);
      await setCompletion(characterId, activityId, week, nextDone);
    });
  }

  function dropActivity(to: number) {
    if (dragActivity === null || dragActivity === to) return;
    const from = dragActivity;
    setDragActivity(null);

    startTransition(async () => {
      moveActivity({ from, to });
      await reorderActivities(
        applyMove(shownActivities, { from, to }).map((a) => a.id),
      );
    });
  }

  function dropCharacter(to: number) {
    if (dragCharacter === null || dragCharacter === to) return;
    const from = dragCharacter;
    setDragCharacter(null);

    startTransition(async () => {
      moveCharacter({ from, to });
      await reorderCharacters(
        applyMove(shownCharacters, { from, to }).map((c) => c.id),
      );
    });
  }

  function removeActivity(activity: Activity) {
    if (!confirm(`Delete "${activity.name}" and all progress against it?`)) return;

    const form = new FormData();
    form.set("id", activity.id);
    startTransition(() => {
      void deleteActivity(form);
    });
  }

  function removeCharacter(character: Character) {
    if (!confirm(`Delete ${character.name} and all their progress?`)) return;

    const form = new FormData();
    form.set("id", character.id);
    startTransition(() => {
      void deleteCharacter(form);
    });
  }

  const highlight = "bg-accent/12";

  return (
    <div
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      onMouseLeave={() => {
        setHoverRow(null);
        setHoverCol(null);
      }}
    >
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-panel px-3 py-2 text-left text-xs font-semibold tracking-wider text-fg-dim uppercase">
              Character
            </th>

            {shownActivities.map((activity, index) => (
              <th
                key={activity.id}
                draggable={!readOnly}
                onDragStart={() => setDragActivity(index)}
                onDragEnd={() => setDragActivity(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropActivity(index)}
                onMouseEnter={() => setHoverCol(activity.id)}
                className={[
                  "px-3 py-2 text-center text-xs font-semibold tracking-wider text-fg-dim uppercase transition-colors",
                  !readOnly && "cursor-grab active:cursor-grabbing",
                  dragActivity === index && "opacity-40",
                  hoverCol === activity.id && highlight,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="inline-flex items-center gap-1">
                  {activity.name}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => removeActivity(activity)}
                      aria-label={`Delete ${activity.name}`}
                      className="cursor-pointer rounded px-1 text-fg-dim/60 hover:bg-danger/10 hover:text-danger"
                    >
                      &times;
                    </button>
                  )}
                </span>
              </th>
            ))}

            {!readOnly && <th className="w-10" />}
          </tr>
        </thead>

        <tbody>
          {shownCharacters.map((character, rowIndex) => (
            <tr
              key={character.id}
              onMouseEnter={() => setHoverRow(character.id)}
              className={[
                "border-t border-line transition-colors",
                dragCharacter === rowIndex && "opacity-40",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <th
                scope="row"
                draggable={!readOnly}
                onDragStart={() => setDragCharacter(rowIndex)}
                onDragEnd={() => setDragCharacter(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropCharacter(rowIndex)}
                className={[
                  "sticky left-0 z-10 px-3 py-2 text-left font-normal transition-colors",
                  hoverRow === character.id ? "bg-panel-2" : "bg-panel",
                  !readOnly && "cursor-grab active:cursor-grabbing",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="block">{character.name}</span>
                {character.job && (
                  <span className="block text-xs text-fg-dim">
                    {character.job}
                  </span>
                )}
              </th>

              {shownActivities.map((activity) => {
                const isDone = done.has(key(character.id, activity.id));
                const crosshair =
                  hoverRow === character.id || hoverCol === activity.id;

                return (
                  <td
                    key={activity.id}
                    onMouseEnter={() => setHoverCol(activity.id)}
                    className={[
                      "p-1 text-center transition-colors",
                      crosshair && highlight,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggle(character.id, activity.id)}
                      aria-pressed={isDone}
                      aria-label={`${character.name} — ${activity.name}`}
                      className={[
                        // Fixed square rather than filling the cell: column
                        // widths follow the activity names, so a stretched
                        // toggle would be a different size in every column.
                        "size-9 rounded-md border align-middle transition-colors",
                        readOnly ? "cursor-default" : "cursor-pointer",
                        isDone
                          ? "border-success/40 bg-success/20 text-success"
                          : "border-line bg-panel-2 text-transparent",
                        !readOnly && !isDone && "hover:border-fg-dim",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      ✓
                    </button>
                  </td>
                );
              })}

              {!readOnly && (
                <td
                  className={[
                    "p-1 text-center transition-colors",
                    hoverRow === character.id && highlight,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => removeCharacter(character)}
                    aria-label={`Delete ${character.name}`}
                    className="cursor-pointer rounded px-2 py-1 text-fg-dim hover:bg-danger/10 hover:text-danger"
                  >
                    &times;
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!readOnly && (
        <p className="mt-3 text-xs text-fg-dim">
          Drag a column header or a character name to reorder.
        </p>
      )}
    </div>
  );
}

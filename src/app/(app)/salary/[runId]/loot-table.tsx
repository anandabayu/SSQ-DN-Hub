"use client";

import { useOptimistic, useState, useTransition } from "react";

import { Button, EmptyState, Input } from "@/components/ui";
import { formatGold } from "@/lib/domain/money";
import type { LootItem } from "@/lib/domain/database.types";

import {
  addLootItem,
  removeLootItem,
  reorderLootItems,
  updateLootItem,
} from "../actions";
import {
  applyMove,
  DragHandle,
  type Move,
} from "@/components/drag-handle";

export function LootTable({
  runId,
  items,
}: {
  runId: string;
  items: LootItem[];
}) {
  const [, startTransition] = useTransition();

  const [shown, moveItem] = useOptimistic<LootItem[], Move>(items, applyMove);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function drop(to: number) {
    if (dragIndex === null || dragIndex === to) return;
    const from = dragIndex;
    setDragIndex(null);

    startTransition(async () => {
      moveItem({ from, to });
      await reorderLootItems(
        runId,
        applyMove(shown, { from, to }).map((i) => i.id),
      );
    });
  }

  const save = (itemId: string, patch: Partial<LootItem>) =>
    startTransition(() => {
      void updateLootItem(runId, itemId, patch);
    });

  const total = items.reduce((sum, item) => sum + Number(item.sold_price), 0);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyState>No loot recorded yet.</EmptyState>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-xs tracking-wider text-fg-dim uppercase">
                <th className="w-7" />
                <th className="pb-2 text-left font-semibold">Item</th>
                <th className="w-32 pb-2 text-right font-semibold">Sold for</th>
                <th className="w-20 pb-2 text-center font-semibold">Sold</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {shown.map((item, index) => (
                <tr
                  key={item.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(index)}
                  className={[
                    "border-t border-line transition-colors",
                    // Sold items recede; what's left is what still needs selling.
                    item.sold
                      ? "bg-success/8 hover:bg-success/15"
                      : "hover:bg-panel-2/60",
                    dragIndex === index && "opacity-40",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <DragHandle
                    onDragStart={() => setDragIndex(index)}
                    onDragEnd={() => setDragIndex(null)}
                    label={`Reorder ${item.name || "item"}`}
                  />
                  <td className="py-1 pr-2">
                    <Input
                      defaultValue={item.name}
                      placeholder="e.g. Ancient Ore"
                      onBlur={(e) =>
                        e.target.value !== item.name &&
                        save(item.id, { name: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="tabular text-right"
                      defaultValue={String(item.sold_price)}
                      onBlur={(e) =>
                        Number(e.target.value) !== Number(item.sold_price) &&
                        save(item.id, {
                          sold_price: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={item.sold}
                      onChange={(e) => save(item.id, { sold: e.target.checked })}
                      aria-label={`${item.name || "Item"} sold`}
                      className="size-4 cursor-pointer accent-[#5ecb8a]"
                    />
                  </td>
                  <td className="py-1 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(() => {
                          void removeLootItem(runId, item.id);
                        })
                      }
                      aria-label={`Remove ${item.name || "item"}`}
                      className="cursor-pointer rounded px-2 py-1 text-fg-dim hover:bg-danger/10 hover:text-danger"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td />
                <td className="py-2 text-xs tracking-wide text-fg-dim uppercase">
                  Total
                </td>
                <td className="tabular py-2 text-right font-semibold text-gold">
                  {formatGold(total)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Button
        onClick={() =>
          startTransition(() => {
            void addLootItem(runId);
          })
        }
      >
        + Add Loot Item
      </Button>
    </div>
  );
}

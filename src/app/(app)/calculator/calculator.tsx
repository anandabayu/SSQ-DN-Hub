"use client";

import { useMemo, useRef, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { formatGold } from "@/lib/domain/money";

interface Row {
  id: number;
  name: string;
  price: string;
  qty: string;
}

let nextId = 0;
const blankRow = (): Row => ({ id: nextId++, name: "", price: "", qty: "1" });

function toPositive(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Deliberately stateless across reloads. This is the one section with no
 * database tables — it exists to answer "what is this pile worth" and then be
 * thrown away.
 */
export function Calculator() {
  const [rows, setRows] = useState<Row[]>(() => [
    blankRow(),
    blankRow(),
    blankRow(),
  ]);
  const lastNameRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    let total = 0;
    let items = 0;
    let units = 0;

    for (const row of rows) {
      const sub = toPositive(row.price) * toPositive(row.qty);
      total += sub;
      if (sub > 0) {
        items += 1;
        units += toPositive(row.qty);
      }
    }

    return { total, items, units };
  }, [rows]);

  function update(id: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [...current, blankRow()]);
    // Focus lands after the new row paints.
    requestAnimationFrame(() => lastNameRef.current?.focus());
  }

  function removeRow(id: number) {
    setRows((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length ? next : [blankRow()];
    });
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {/* Table on desktop, stacked cards on mobile. */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs tracking-wider text-fg-dim uppercase">
                <th className="pb-2 text-left font-semibold">Item</th>
                <th className="w-[22%] pb-2 text-right font-semibold">Price</th>
                <th className="w-[14%] pb-2 text-right font-semibold">Qty</th>
                <th className="w-[22%] pb-2 text-right font-semibold">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="py-1 pr-2">
                    <Input
                      ref={index === rows.length - 1 ? lastNameRef : undefined}
                      value={row.name}
                      onChange={(e) => update(row.id, { name: e.target.value })}
                      placeholder="e.g. Ancient Ore"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="tabular text-right"
                      value={row.price}
                      onChange={(e) => update(row.id, { price: e.target.value })}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="tabular text-right"
                      value={row.qty}
                      onChange={(e) => update(row.id, { qty: e.target.value })}
                      placeholder="1"
                    />
                  </td>
                  <td className="tabular px-1 py-1 text-right whitespace-nowrap text-gold">
                    {formatGold(toPositive(row.price) * toPositive(row.qty))}
                  </td>
                  <td className="py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Remove ${row.name || "row"}`}
                      className="cursor-pointer rounded px-2 py-1 text-fg-dim transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 sm:hidden">
          {rows.map((row, index) => (
            <div key={row.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center gap-2">
                <Input
                  ref={index === rows.length - 1 ? lastNameRef : undefined}
                  value={row.name}
                  onChange={(e) => update(row.id, { name: e.target.value })}
                  placeholder="Item name"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  aria-label={`Remove ${row.name || "row"}`}
                  className="shrink-0 cursor-pointer rounded px-2 py-1 text-fg-dim hover:text-danger"
                >
                  &times;
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  className="tabular text-right"
                  value={row.price}
                  onChange={(e) => update(row.id, { price: e.target.value })}
                  placeholder="Price"
                />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  className="tabular text-right"
                  value={row.qty}
                  onChange={(e) => update(row.id, { qty: e.target.value })}
                  placeholder="Qty"
                />
                <span className="tabular text-right text-sm text-gold">
                  {formatGold(toPositive(row.price) * toPositive(row.qty))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={addRow}>+ Add Item</Button>
        <Button
          variant="ghost"
          onClick={() => setRows([blankRow(), blankRow(), blankRow()])}
        >
          Clear All
        </Button>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-line border-l-[3px] border-l-gold bg-panel px-5 py-4">
        <span className="text-xs tracking-wider text-fg-dim uppercase">
          Total Price
        </span>
        <span className="tabular text-3xl font-bold text-gold">
          {formatGold(totals.total)}
        </span>
        <span className="w-full text-xs text-fg-dim">
          {totals.items} {totals.items === 1 ? "item" : "items"} &middot;{" "}
          {formatGold(totals.units)} {totals.units === 1 ? "unit" : "units"}
        </span>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, Input } from "@/components/ui";
import type { Run } from "@/lib/domain/database.types";

import { updateRun } from "../actions";

/**
 * Matches the original app's detail header: one wrapping row, with the title
 * and IGN as borderless inline text that only reveals its input chrome on
 * hover or focus. They read as a heading until you go to edit them.
 *
 * Saved on blur rather than per keystroke.
 */

const INLINE_FIELD =
  "rounded-md border border-transparent bg-transparent px-2 " +
  "hover:border-line hover:bg-panel-2 focus:border-line focus:bg-panel-2 " +
  "focus:outline-none transition-colors";

export function RunHeader({ run, readOnly }: { run: Run; readOnly: boolean }) {
  const [, startTransition] = useTransition();
  const [name, setName] = useState(run.name);
  const [ign, setIgn] = useState(run.ign);
  const [ssPrice, setSsPrice] = useState(String(run.ss_price));
  const [tax, setTax] = useState(String(run.tax_per_trade));

  const save = (patch: Partial<Run>) =>
    startTransition(() => {
      void updateRun(run.id, patch);
    });

  return (
    <div className="space-y-3">
      {/* Navigation and status on their own row, above the party's details. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/salary">
          <Button>&larr; Back</Button>
        </Link>

        {!readOnly && (
          <Button
            variant={run.completed ? "default" : "success"}
            onClick={() => save({ completed: !run.completed })}
          >
            {run.completed ? "Reopen" : "Mark as Complete"}
          </Button>
        )}
        {readOnly && run.completed && (
          <span className="text-sm font-medium text-success">✓ Completed</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={name}
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== run.name && save({ name })}
          maxLength={60}
          aria-label="Party name"
          className={`${INLINE_FIELD} max-w-[380px] min-w-0 flex-1 py-1.5 text-lg font-semibold text-fg`}
        />

        <input
          value={ign}
          disabled={readOnly}
          onChange={(e) => setIgn(e.target.value)}
          onBlur={() => ign !== run.ign && save({ ign })}
          placeholder="IGN"
          maxLength={30}
          aria-label="IGN handling loot"
          className={`${INLINE_FIELD} max-w-[160px] py-1 text-sm font-medium text-gold placeholder:text-fg-dim`}
        />

        {/* Stacked, right-aligned. Labels share a column so the two inputs
            line up under each other. */}
        <div className="ml-auto flex flex-col gap-1.5">
          {/* `Input` is w-full by design, so the width is set by a fixed-width
            wrapper rather than a competing width utility on the input itself —
            two width classes on one element is a coin flip on CSS order. */}
          <label className="flex items-center justify-end gap-2 text-sm whitespace-nowrap text-fg-dim">
            Gold per 1 Seal Stamp
            <span className="w-14 shrink-0">
              <Input
                type="number"
                min="1"
                step="1"
                value={ssPrice}
                disabled={readOnly}
                onChange={(e) => setSsPrice(e.target.value)}
                onBlur={() =>
                  Number(ssPrice) !== Number(run.ss_price) &&
                  save({ ss_price: Number(ssPrice) || 0 })
                }
                className="tabular px-2 text-right"
              />
            </span>
          </label>

          <label className="flex items-center justify-end gap-2 text-sm whitespace-nowrap text-fg-dim">
            Tax per Trade
            <span className="w-14 shrink-0">
              <Input
                type="number"
                min="1"
                step="1"
                value={tax}
                disabled={readOnly}
                onChange={(e) => setTax(e.target.value)}
                onBlur={() =>
                  Number(tax) !== Number(run.tax_per_trade) &&
                  save({ tax_per_trade: Number(tax) || 0 })
                }
                className="tabular px-2 text-right"
              />
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { canEditRun, requireSalaryAccess } from "@/lib/auth";
import { Button, Card, EmptyState, Input } from "@/components/ui";
import {
  computeProgress,
  computeTotals,
  formatGold,
} from "@/lib/domain/money";
import type {
  LootItem,
  RosterUser,
  Profile,
  Run,
  RunPlayer,
} from "@/lib/domain/database.types";

import { createRun } from "./actions";
import { RosterModal } from "./roster-card";
import { PartyCardActions } from "./party-card-actions";

export const metadata = { title: "Salary — SSQ DN Hub" };

type RunWithChildren = Run & {
  run_players: RunPlayer[];
  loot_items: LootItem[];
};

function RunCard({
  run,
  profile,
}: {
  run: RunWithChildren;
  profile: Profile;
}) {
  const players = run.run_players.map((p) => ({
    ssUsed: Number(p.ss_used),
    paid: p.paid,
  }));
  const items = run.loot_items.map((i) => ({
    soldPrice: Number(i.sold_price),
    sold: i.sold,
  }));

  const totals = computeTotals(
    { ssPrice: Number(run.ss_price), taxPerTrade: Number(run.tax_per_trade) },
    players,
    items,
  );
  const progress = computeProgress(players, items);

  const pct = (done: number, total: number) =>
    total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="relative rounded-xl border border-line bg-panel/80 p-4 transition-colors hover:border-gold">
      {run.completed && (
        <div className="mb-1 text-xs font-medium text-success">✓ Completed</div>
      )}

      <h3 className="truncate pr-14 font-semibold">{run.name}</h3>
      {run.ign && <p className="mt-0.5 text-xs text-gold">IGN: {run.ign}</p>}

      <div className="mt-2 space-y-0.5 text-xs text-fg-dim">
        <div>
          {progress.playersTotal}/8 players &middot; {progress.lootTotal}{" "}
          item(s)
        </div>
        <div>
          Total:{" "}
          <span className="tabular font-semibold text-gold">
            {formatGold(totals.totalSold)} g
          </span>
        </div>
      </div>

      <ProgressBar
        label="Loot Sold"
        done={progress.lootSold}
        total={progress.lootTotal}
        percent={pct(progress.lootSold, progress.lootTotal)}
        tone="gold"
      />
      <ProgressBar
        label="Gold Shared"
        done={progress.playersPaid}
        total={progress.playersTotal}
        percent={pct(progress.playersPaid, progress.playersTotal)}
        tone="success"
      />

      {/* Stretched link: covers the card so the whole thing is clickable,
          while the action buttons sit above it. */}
      <Link
        href={`/salary/${run.id}`}
        aria-label={`Open ${run.name}`}
        className="absolute inset-0 rounded-xl"
      />

      <PartyCardActions
        runId={run.id}
        runName={run.name}
        canDelete={canEditRun(profile, run)}
      />
    </div>
  );
}

function ProgressBar({
  label,
  done,
  total,
  percent,
  tone,
}: {
  label: string;
  done: number;
  total: number;
  percent: number;
  tone: "gold" | "success";
}) {
  return (
    <div className="mt-2.5">
      <div className="mb-1 flex justify-between text-xs text-fg-dim">
        <span>{label}</span>
        <span className="tabular">
          {done}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div
          className={`h-full rounded-full transition-[width] ${
            tone === "gold" ? "bg-gold" : "bg-success"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default async function SalaryPage() {
  const profile = await requireSalaryAccess();
  const supabase = await createClient();

  const [{ data }, { data: roster }] = await Promise.all([
    supabase
      .from("runs")
      .select("*, run_players(*), loot_items(*)")
      .order("created_at", { ascending: false }),
    supabase.from("roster_users").select("*").order("alias"),
  ]);

  const runs = (data ?? []) as unknown as RunWithChildren[];
  const active = runs.filter((r) => !r.completed);
  const completed = runs.filter((r) => r.completed);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Raid Loot Split</h1>
        <p className="mt-1 text-sm text-fg-dim">
          Party loot and seal stamp settlement.
        </p>
      </div>

      <Card title="Create Party">
        <form action={createRun} className="flex flex-wrap gap-2">
          <Input
            name="name"
            placeholder="Party name (e.g. Argenta Sat Run)"
            maxLength={60}
            required
            className="min-w-0 flex-1"
          />
          <Input
            name="ign"
            placeholder="IGN handling loot"
            maxLength={30}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="primary">
            + New Party
          </Button>
        </form>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-fg-dim uppercase">
            Active <span className="text-fg-dim/60">({active.length})</span>
          </h2>
          {/* In a modal rather than a card: a long roster would otherwise push
              the party list off screen. */}
          <RosterModal roster={(roster ?? []) as RosterUser[]} />
        </div>
        {active.length === 0 ? (
          <EmptyState>No active parties. Create one above.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((run) => (
              <RunCard key={run.id} run={run} profile={profile} />
            ))}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold tracking-wide text-fg-dim uppercase">
            Completed <span className="text-fg-dim/60">({completed.length})</span>
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((run) => (
              <RunCard key={run.id} run={run} profile={profile} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

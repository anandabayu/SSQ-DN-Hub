import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import {
  computeResidue,
  computeTotals,
  computeUnsharedGold,
  formatGold,
} from "@/lib/domain/money";
import type {
  LootItem,
  RosterUser,
  Run,
  RunPlayer,
  WebhookOption,
} from "@/lib/domain/database.types";

import { LootTable } from "./loot-table";
import { PlayersTable } from "./players-table";
import { RunHeader } from "./run-header";
import { DiscordPanel } from "./discord-panel";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const supabase = await createClient();

  const [
    { data: run },
    { data: players },
    { data: loot },
    { data: roster },
    { data: channels },
  ] = await Promise.all([
    supabase.from("runs").select("*").eq("id", runId).single(),
    supabase
      .from("run_players")
      .select("*")
      .eq("run_id", runId)
      .order("sort_order"),
    supabase
      .from("loot_items")
      .select("*")
      .eq("run_id", runId)
      .order("sort_order"),
    supabase.from("roster_users").select("*").order("alias"),

    supabase.from("webhook_options").select("*").order("name"),
  ]);

  if (!run) notFound();

  const typedRun = run as Run;
  const typedPlayers = (players ?? []) as RunPlayer[];
  const typedLoot = (loot ?? []) as LootItem[];

  const settings = {
    ssPrice: Number(typedRun.ss_price),
    taxPerTrade: Number(typedRun.tax_per_trade),
  };
  const playerLikes = typedPlayers.map((p) => ({
    ssUsed: Number(p.ss_used),
    paid: p.paid,
  }));
  const lootLikes = typedLoot.map((i) => ({ soldPrice: Number(i.sold_price) }));

  const totals = computeTotals(settings, playerLikes, lootLikes);
  const unshared = computeUnsharedGold(settings, playerLikes, totals);
  const residue = computeResidue(playerLikes, totals);

  const stats = [
    { label: "Total Sold", value: totals.totalSold },
    { label: "Reimbursed (SS)", value: totals.totalReimb },
    { label: "Remaining", value: totals.remaining },
    { label: "Even Share", value: totals.evenShare },
    { label: "Unshared", value: unshared },
  ];

  return (
    <div className="space-y-4">
      <RunHeader run={typedRun} />

      <Card title={`Players (${typedPlayers.length}/8)`}>
        <PlayersTable
          runId={runId}
          players={typedPlayers}
          roster={(roster ?? []) as RosterUser[]}
          settings={settings}
          totals={totals}
        />
      </Card>

      <Card title={`Loot Items (${typedLoot.length})`}>
        <LootTable runId={runId} items={typedLoot} />
      </Card>

      <Card title="Summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-line bg-panel-2 px-3 py-3"
            >
              <div className="text-xs tracking-wide text-fg-dim uppercase">
                {stat.label}
              </div>
              <div className="tabular mt-1 text-lg font-semibold text-gold">
                {formatGold(stat.value)}
              </div>
            </div>
          ))}
        </div>

        {residue !== 0 && (
          <p className="mt-3 text-xs text-fg-dim">
            {formatGold(residue)} g left over from rounding the even share down.
            Hand it out however you like — the original app silently dropped
            this.
          </p>
        )}
      </Card>

      <DiscordPanel
        run={typedRun}
        channels={(channels ?? []) as WebhookOption[]}
      />
    </div>
  );
}

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { canEditRun, canManageRun, requireSalaryAccess } from "@/lib/auth";
import { Banner, Card } from "@/components/ui";
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
  SalaryUser,
  WebhookOption,
} from "@/lib/domain/database.types";

import { LootTable } from "./loot-table";
import { PlayersTable } from "./players-table";
import { RunHeader } from "./run-header";
import { DiscordPanel } from "./discord-panel";
import { EditorsModal } from "./editors-modal";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const profile = await requireSalaryAccess();
  const supabase = await createClient();

  const [
    { data: run },
    { data: players },
    { data: loot },
    { data: roster },
    { data: channels },
    { data: editorRows },
    { data: salaryUsers },
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
    supabase.from("run_editors").select("user_id").eq("run_id", runId),
    supabase.from("salary_users").select("*").order("alias"),
  ]);

  if (!run) notFound();

  const typedRun = run as Run;

  const candidates = (salaryUsers ?? []) as SalaryUser[];
  const editorIds = (editorRows ?? []).map((row) => row.user_id);

  // `salary_users` is a name-only view every salary user can read — unlike
  // `profiles`, which a member can only read their own row of.
  const byId = new Map(candidates.map((user) => [user.id, user]));
  const creatorAlias = typedRun.created_by
    ? (byId.get(typedRun.created_by)?.alias ?? null)
    : null;
  const editors = editorIds
    .map((id) => byId.get(id))
    .filter((user): user is SalaryUser => Boolean(user));
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

  const editable = canEditRun(profile, typedRun, editorIds);
  const manageable = canManageRun(profile, typedRun);

  return (
    <div className="space-y-4">
      <RunHeader
        run={typedRun}
        readOnly={!editable}
        editors={
          <EditorsModal
            runId={runId}
            creatorAlias={creatorAlias}
            editors={editors}
            candidates={candidates}
            canManage={manageable}
          />
        }
      />

      {!editable && (
        <Banner tone="warning">
          <span aria-hidden>👁</span>
          Read-only &mdash; {creatorAlias ?? "the party's creator"}, an admin, or
          someone they add as an editor can change this party.
        </Banner>
      )}

      <Card title={`Players (${typedPlayers.length}/8)`}>
        <PlayersTable
          runId={runId}
          players={typedPlayers}
          roster={(roster ?? []) as RosterUser[]}
          settings={settings}
          totals={totals}
          readOnly={!editable}
        />
      </Card>

      <Card title={`Loot Items (${typedLoot.length})`}>
        <LootTable runId={runId} items={typedLoot} readOnly={!editable} />
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
        readOnly={!editable}
      />
    </div>
  );
}

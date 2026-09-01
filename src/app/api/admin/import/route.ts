import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * One-time importer for the old DN Salary app's "Export Data (JSON)" file.
 *
 * Runs through the RLS client, so the caller's salary access is what
 * authorises the writes. Webhook URLs in the export are deliberately dropped:
 * they belong in the admin-only webhooks table now, entered by hand.
 */

const LegacyPlayer = z.object({
  name: z.string().default(""),
  ign: z.string().default(""),
  discordId: z.string().default(""),
  ssUsed: z.coerce.number().default(0),
  paid: z.boolean().default(false),
});

const LegacyLoot = z.object({
  name: z.string().default(""),
  soldPrice: z.coerce.number().default(0),
  sold: z.boolean().default(false),
});

const LegacyParty = z.object({
  name: z.string().default("Imported Party"),
  ign: z.string().default(""),
  completed: z.boolean().default(false),
  ssPrice: z.coerce.number().default(4),
  taxPerTrade: z.coerce.number().default(1),
  players: z.array(LegacyPlayer).default([]),
  lootItems: z.array(LegacyLoot).default([]),
});

const LegacyRoster = z.object({
  alias: z.string().default(""),
  defaultIgn: z.string().default(""),
  discordId: z.string().default(""),
});

const LegacyExport = z.object({
  parties: z.array(LegacyParty).default([]),
  roster: z.array(LegacyRoster).default([]),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: allowed } = await supabase.rpc("has_salary_access");
  if (!allowed) {
    return NextResponse.json({ error: "No salary access." }, { status: 403 });
  }

  const parsed = LegacyExport.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That doesn't look like a DN Salary export." },
      { status: 400 },
    );
  }

  const { parties, roster } = parsed.data;
  let importedRuns = 0;

  if (roster.length) {
    await supabase.from("roster_users").insert(
      roster
        .filter((entry) => entry.alias)
        .map((entry) => ({
          alias: entry.alias,
          default_ign: entry.defaultIgn,
          discord_id: entry.discordId,
        })),
    );
  }

  for (const party of parties) {
    const { data: run } = await supabase
      .from("runs")
      .insert({
        name: party.name,
        ign: party.ign,
        created_by: user.id,
        completed: party.completed,
        ss_price: party.ssPrice,
        tax_per_trade: party.taxPerTrade,
      })
      .select("id")
      .single();

    if (!run) continue;
    importedRuns += 1;

    // Legacy exports can exceed the 8-player cap the trigger enforces, so keep
    // the first 8 rather than failing the whole import.
    if (party.players.length) {
      await supabase.from("run_players").insert(
        party.players.slice(0, 8).map((player, index) => ({
          run_id: run.id,
          name: player.name,
          ign: player.ign,
          discord_id: player.discordId,
          ss_used: player.ssUsed,
          paid: player.paid,
          sort_order: index,
        })),
      );
    }

    if (party.lootItems.length) {
      await supabase.from("loot_items").insert(
        party.lootItems.map((item, index) => ({
          run_id: run.id,
          name: item.name,
          sold_price: item.soldPrice,
          sold: item.sold,
          sort_order: index,
        })),
      );
    }
  }

  return NextResponse.json({
    ok: true,
    importedRuns,
    importedRoster: roster.length,
  });
}

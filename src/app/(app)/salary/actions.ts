"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSalaryAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  LootItem,
  RosterUser,
  Run,
  RunPlayer,
} from "@/lib/domain/database.types";

export async function createRun(formData: FormData) {
  const profile = await requireSalaryAccess();

  const name = String(formData.get("name") ?? "").trim() || "New Party";
  const ign = String(formData.get("ign") ?? "").trim();

  const supabase = await createClient();
  const { data } = await supabase
    .from("runs")
    .insert({ name, ign, created_by: profile.id })
    .select("id")
    .single();

  revalidatePath("/salary");
  if (data) redirect(`/salary/${data.id}`);
}

export async function updateRun(runId: string, patch: Partial<Run>) {
  await requireSalaryAccess();

  const supabase = await createClient();
  await supabase.from("runs").update(patch).eq("id", runId);

  revalidatePath(`/salary/${runId}`);
  revalidatePath("/salary");
}

export async function deleteRun(formData: FormData) {
  await requireSalaryAccess();

  const runId = String(formData.get("runId") ?? "");
  if (!runId) return;

  const supabase = await createClient();
  await supabase.from("runs").delete().eq("id", runId);

  revalidatePath("/salary");
  redirect("/salary");
}

/**
 * Duplicates a run's roster for a fresh outing: same players, no loot, no SS
 * or paid state, and no Discord thread links — those belong to the original
 * run's thread.
 */
export async function copyRun(formData: FormData) {
  const profile = await requireSalaryAccess();

  const runId = String(formData.get("runId") ?? "");
  if (!runId) return;

  const supabase = await createClient();

  const [{ data: source }, { data: players }] = await Promise.all([
    supabase.from("runs").select("*").eq("id", runId).single(),
    supabase.from("run_players").select("*").eq("run_id", runId).order("sort_order"),
  ]);

  if (!source) return;

  const { data: created } = await supabase
    .from("runs")
    .insert({
      name: `${source.name} (Copy)`,
      ign: source.ign,
      created_by: profile.id,
      ss_price: source.ss_price,
      tax_per_trade: source.tax_per_trade,
      webhook_id: source.webhook_id,
    })
    .select("id")
    .single();

  if (!created) return;

  if (players?.length) {
    await supabase.from("run_players").insert(
      players.map((player, index) => ({
        run_id: created.id,
        roster_user_id: player.roster_user_id,
        name: player.name,
        ign: player.ign,
        discord_id: player.discord_id,
        ss_used: 0,
        paid: false,
        sort_order: index,
      })),
    );
  }

  revalidatePath("/salary");
  redirect(`/salary/${created.id}`);
}

/* -------------------------------------------------------------------------
 * Saved users (the roster).
 *
 * These are Dragon Nest players, not app accounts — they never log in. Kept
 * separate from `profiles` so you can settle loot with someone who has no
 * login, and so a login account isn't required to appear in a party.
 * ---------------------------------------------------------------------- */

export async function addRosterUser(formData: FormData) {
  await requireSalaryAccess();

  const alias = String(formData.get("alias") ?? "").trim();
  if (!alias) return;

  const supabase = await createClient();
  await supabase.from("roster_users").insert({
    alias,
    default_ign: String(formData.get("default_ign") ?? "").trim(),
    discord_id: String(formData.get("discord_id") ?? "").trim(),
  });

  revalidatePath("/salary");
}

export async function updateRosterUser(
  id: string,
  patch: Partial<RosterUser>,
) {
  await requireSalaryAccess();

  const supabase = await createClient();
  await supabase.from("roster_users").update(patch).eq("id", id);

  revalidatePath("/salary");
}

export async function deleteRosterUser(formData: FormData) {
  await requireSalaryAccess();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("roster_users").delete().eq("id", id);

  revalidatePath("/salary");
}

/**
 * Adds a player to a run. If `alias` matches a saved user, their Discord ID
 * and default IGN come across automatically — the whole point of the roster is
 * not retyping a Discord snowflake for every run.
 *
 * An unmatched alias still works: ad-hoc players don't have to be saved first.
 */
export async function addPlayer(
  runId: string,
  input?: { alias?: string; ign?: string },
) {
  await requireSalaryAccess();

  const supabase = await createClient();
  const alias = (input?.alias ?? "").trim();
  const typedIgn = (input?.ign ?? "").trim();

  let rosterUserId: string | null = null;
  let discordId = "";
  let ign = typedIgn;

  if (alias) {
    const { data: match } = await supabase
      .from("roster_users")
      .select("*")
      .ilike("alias", alias)
      .limit(1)
      .maybeSingle();

    if (match) {
      rosterUserId = match.id;
      discordId = match.discord_id;
      // An IGN typed for this run wins: mains get swapped for alts all the time.
      if (!ign) ign = match.default_ign;
    }
  }

  const { count } = await supabase
    .from("run_players")
    .select("*", { count: "exact", head: true })
    .eq("run_id", runId);

  const { error } = await supabase.from("run_players").insert({
    run_id: runId,
    roster_user_id: rosterUserId,
    name: alias,
    ign,
    discord_id: discordId,
    sort_order: count ?? 0,
  });

  revalidatePath(`/salary/${runId}`);
  // The 8-player cap is a database trigger, so surface its message rather than
  // duplicating the limit here.
  if (error) return { error: error.message };
  return { ok: true };
}

export async function updatePlayer(
  runId: string,
  playerId: string,
  patch: Partial<RunPlayer>,
) {
  await requireSalaryAccess();

  const supabase = await createClient();
  await supabase.from("run_players").update(patch).eq("id", playerId);

  revalidatePath(`/salary/${runId}`);
}

/**
 * Saves a player from a party into the roster, so next run they can be
 * quick-picked instead of retyped.
 *
 * If an alias already exists it links to that entry rather than creating a
 * duplicate — the roster is keyed by how people actually refer to each other,
 * and two "Ananda" rows would make the picker useless.
 */
export async function savePlayerToRoster(runId: string, playerId: string) {
  await requireSalaryAccess();

  const supabase = await createClient();

  const { data: player } = await supabase
    .from("run_players")
    .select("*")
    .eq("id", playerId)
    .single();

  if (!player) return { error: "Player not found." };

  const alias = player.name.trim();
  if (!alias) return { error: "Give the player a name before saving them." };

  const { data: existing } = await supabase
    .from("roster_users")
    .select("id")
    .ilike("alias", alias)
    .limit(1)
    .maybeSingle();

  let rosterUserId = existing?.id;

  if (!rosterUserId) {
    const { data: created, error } = await supabase
      .from("roster_users")
      .insert({
        alias,
        default_ign: player.ign,
        discord_id: player.discord_id,
      })
      .select("id")
      .single();

    if (error || !created) {
      return { error: error?.message ?? "Could not save that player." };
    }
    rosterUserId = created.id;
  }

  await supabase
    .from("run_players")
    .update({ roster_user_id: rosterUserId })
    .eq("id", playerId);

  revalidatePath(`/salary/${runId}`);
  revalidatePath("/salary");
  return { ok: true };
}

export async function removePlayer(runId: string, playerId: string) {
  await requireSalaryAccess();

  const supabase = await createClient();
  await supabase.from("run_players").delete().eq("id", playerId);

  revalidatePath(`/salary/${runId}`);
}

/**
 * Persists a drag-reorder. Writes the full id list with explicit positions, so
 * a partial failure can't leave two rows sharing a sort_order.
 */
export async function reorderPlayers(runId: string, ids: string[]) {
  await requireSalaryAccess();

  const supabase = await createClient();
  await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("run_players")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("run_id", runId),
    ),
  );

  revalidatePath(`/salary/${runId}`);
}

export async function reorderLootItems(runId: string, ids: string[]) {
  await requireSalaryAccess();

  const supabase = await createClient();
  await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("loot_items")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("run_id", runId),
    ),
  );

  revalidatePath(`/salary/${runId}`);
}

export async function addLootItem(runId: string) {
  await requireSalaryAccess();

  const supabase = await createClient();
  const { count } = await supabase
    .from("loot_items")
    .select("*", { count: "exact", head: true })
    .eq("run_id", runId);

  await supabase
    .from("loot_items")
    .insert({ run_id: runId, sort_order: count ?? 0 });

  revalidatePath(`/salary/${runId}`);
}

export async function updateLootItem(
  runId: string,
  itemId: string,
  patch: Partial<LootItem>,
) {
  await requireSalaryAccess();

  const supabase = await createClient();
  await supabase.from("loot_items").update(patch).eq("id", itemId);

  revalidatePath(`/salary/${runId}`);
}

export async function removeLootItem(runId: string, itemId: string) {
  await requireSalaryAccess();

  const supabase = await createClient();
  await supabase.from("loot_items").delete().eq("id", itemId);

  revalidatePath(`/salary/${runId}`);
}

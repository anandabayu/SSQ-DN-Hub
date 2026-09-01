"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Every action here writes as the signed-in user and never accepts a target
 * user id. Combined with the tracker policies (owner full, admin SELECT only)
 * this is what makes an admin's view of someone else's tracker read-only —
 * there is no code path, and no policy, that would let them write it.
 */

export async function addCharacter(formData: FormData) {
  const profile = await requireProfile();
  const name = String(formData.get("name") ?? "").trim();
  const job = String(formData.get("job") ?? "").trim();

  if (!name) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("characters")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id);

  await supabase.from("characters").insert({
    user_id: profile.id,
    name,
    job,
    sort_order: count ?? 0,
  });

  revalidatePath("/tracker");
}

export async function deleteCharacter(formData: FormData) {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("characters").delete().eq("id", id);

  revalidatePath("/tracker");
}

export async function addActivity(formData: FormData) {
  const profile = await requireProfile();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id);

  await supabase.from("activities").insert({
    user_id: profile.id,
    name,
    sort_order: count ?? 0,
  });

  revalidatePath("/tracker");
}

export async function deleteActivity(formData: FormData) {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("activities").delete().eq("id", id);

  revalidatePath("/tracker");
}

/**
 * Persists a drag-reorder. Takes the full id list in its new order and writes
 * each position, so a partial failure can't leave two rows fighting over the
 * same sort_order.
 *
 * The redundant user_id filter is belt-and-braces — RLS already restricts
 * these to the owner, and admins have no update policy at all.
 */
export async function reorderActivities(ids: string[]) {
  const profile = await requireProfile();
  const supabase = await createClient();

  await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("activities")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("user_id", profile.id),
    ),
  );

  revalidatePath("/tracker");
}

export async function reorderCharacters(ids: string[]) {
  const profile = await requireProfile();
  const supabase = await createClient();

  await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("characters")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("user_id", profile.id),
    ),
  );

  revalidatePath("/tracker");
}

export async function setCompletion(
  characterId: string,
  activityId: string,
  weekOf: string,
  done: boolean,
) {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (done) {
    await supabase.from("completions").upsert(
      {
        user_id: profile.id,
        character_id: characterId,
        activity_id: activityId,
        week_of: weekOf,
        done: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "character_id,activity_id,week_of" },
    );
  } else {
    await supabase
      .from("completions")
      .delete()
      .eq("character_id", characterId)
      .eq("activity_id", activityId)
      .eq("week_of", weekOf);
  }

  revalidatePath("/tracker");
}

"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Permission toggles. These go through the normal (RLS-bound) client — the
 * "profiles: admin updates all" policy is what authorises them, so a member
 * who forged this request would simply update nothing.
 */

/**
 * Alias and Discord ID edits.
 *
 * These live in `profiles`, so they go through the RLS-bound client — the
 * "profiles: admin updates all" policy authorises them, and the privilege
 * guard trigger stops role/access/active being smuggled in through here.
 */
export async function updateProfileDetails(
  id: string,
  patch: { alias?: string; discord_id?: string },
) {
  await requireAdmin();
  if (!id) return;

  const clean: { alias?: string; discord_id?: string } = {};
  if (patch.alias !== undefined) {
    const alias = patch.alias.trim();
    if (!alias) return { error: "Alias cannot be empty." };
    clean.alias = alias;
  }
  if (patch.discord_id !== undefined) {
    clean.discord_id = patch.discord_id.trim();
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(clean).eq("id", id);

  revalidatePath("/admin/users");
  if (error) return { error: error.message };
  return { ok: true };
}

export async function setSalaryAccess(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const value = formData.get("value") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ can_access_salary: value })
    .eq("id", id);

  revalidatePath("/admin/users");
}

export async function setActive(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const value = formData.get("value") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: value }).eq("id", id);

  revalidatePath("/admin/users");
}

export async function setRole(formData: FormData) {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("value") ?? "");
  if (!id || (role !== "admin" && role !== "member")) return;

  // Guard against an admin demoting themselves and locking everyone out of
  // user management.
  if (id === admin.id && role === "member") return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", id);

  revalidatePath("/admin/users");
}

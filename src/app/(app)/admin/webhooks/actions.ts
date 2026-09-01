"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Webhook management. Admin-only in RLS, so these go through the normal
 * (RLS-bound) client — the "webhooks: admin only" policy is the authorisation,
 * and a member forging one of these updates nothing.
 */

function isDiscordWebhook(url: string): boolean {
  return /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(
    url,
  );
}

export async function addWebhook(formData: FormData) {
  const admin = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  if (!name || !url) return { error: "Name and URL are both required." };
  if (!isDiscordWebhook(url)) {
    return { error: "That doesn't look like a Discord webhook URL." };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("webhooks")
    .select("*", { count: "exact", head: true });

  const { error } = await supabase.from("webhooks").insert({
    name,
    url,
    // First one added becomes the default, so sends work without extra setup.
    is_default: (count ?? 0) === 0,
    updated_by: admin.id,
  });

  revalidatePath("/admin/webhooks");
  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateWebhook(formData: FormData) {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  if (!id || !name) return { error: "Name is required." };

  // An empty URL field means "leave it alone" — the form ships masked, so a
  // blank submission must never wipe a working webhook.
  const patch: { name: string; url?: string; updated_by: string } = {
    name,
    updated_by: admin.id,
  };

  if (url) {
    if (!isDiscordWebhook(url)) {
      return { error: "That doesn't look like a Discord webhook URL." };
    }
    patch.url = url;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("webhooks").update(patch).eq("id", id);

  revalidatePath("/admin/webhooks");
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteWebhook(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Runs pointing at this webhook fall back to the default via
  // `on delete set null`, so deleting one never orphans a party.
  await supabase.from("webhooks").delete().eq("id", id);

  revalidatePath("/admin/webhooks");
  revalidatePath("/salary");
}

/** Exactly one default at a time — the send route falls back to it. */
export async function setDefaultWebhook(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("webhooks")
    .update({ is_default: false })
    .neq("id", id);
  await supabase.from("webhooks").update({ is_default: true }).eq("id", id);

  revalidatePath("/admin/webhooks");
  revalidatePath("/salary");
}

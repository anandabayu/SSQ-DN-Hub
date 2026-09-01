import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Webhook } from "@/lib/domain/database.types";

import { WebhookManager } from "./webhook-manager";

export const metadata = { title: "Webhooks — SSQ DN Hub" };

export default async function WebhooksPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Readable here only because the caller is an admin — the
  // "webhooks: admin only" policy returns nothing to anyone else.
  const { data } = await supabase
    .from("webhooks")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Discord Webhooks</h1>
        <p className="mt-1 text-sm text-fg-dim">
          Where the Salary section posts. Only admins can see or change these —
          salary users can send to them without ever receiving the URL.
        </p>
      </div>

      <WebhookManager webhooks={(data ?? []) as Webhook[]} />
    </div>
  );
}

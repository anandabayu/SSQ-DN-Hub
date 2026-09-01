import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/domain/database.types";

/**
 * PRIVILEGED CLIENT - BYPASSES ALL ROW LEVEL SECURITY.
 *
 * The `server-only` import above makes importing this from a client component a
 * build error, not a runtime surprise. Two rules for anything that calls it:
 *
 *   1. Authorise the caller yourself first. RLS is not going to do it for you.
 *   2. Never return a row from `webhooks` to the client. Read the URL, use it
 *      server-side, return a result - not the secret.
 *
 * Used for exactly two things: creating users (an admin-only operation the
 * anon key cannot perform) and resolving Discord webhook URLs for sends.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Admin operations are unavailable.",
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

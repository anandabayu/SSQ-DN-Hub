import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/domain/database.types";

/**
 * Browser client. Uses the anon key, so every query it makes is subject to RLS.
 * This is the only Supabase client that may be imported from a client component.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

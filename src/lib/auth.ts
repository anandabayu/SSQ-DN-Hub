import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/domain/database.types";

/**
 * The signed-in user's profile, or a redirect to /login.
 *
 * Wrapped in React's `cache()` so it runs at most once per request. The app
 * layout needs it for the nav and each section gate needs it again — without
 * deduplication that was two auth calls and two profile queries per
 * navigation, all sequential.
 *
 * Identity comes from `getClaims()` rather than `getUser()`. `getUser()` hits
 * the Auth server on every call; `getClaims()` verifies the JWT signature
 * locally when the project uses asymmetric signing keys, and still refreshes
 * an expiring session because it calls `getSession()` internally. It falls
 * back to a server round trip on legacy HS256 projects, so it is never less
 * safe — only faster where it can be.
 */
export const requireProfile = cache(async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  // Distinct from "deactivated": the auth user exists but has no profiles row,
  // or RLS is hiding it. Both are setup faults rather than a member being
  // switched off, and telling them apart matters when diagnosing.
  if (error || !profile) {
    console.error("[auth] no readable profile row", {
      userId,
      code: error?.code,
      message: error?.message,
    });
    await supabase.auth.signOut();
    redirect("/login?error=no_profile");
  }

  // A deactivated user keeps a valid session until it expires, so check the
  // flag rather than trusting the cookie.
  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }

  return profile;
});

/**
 * Gate for the Salary section. Note this only produces a redirect - the actual
 * enforcement is the `has_salary_access()` policy on every salary table, which
 * holds even if someone calls the API directly.
 */
export async function requireSalaryAccess(): Promise<Profile> {
  const profile = await requireProfile();

  if (!profile.can_access_salary && profile.role !== "admin") {
    redirect("/tracker?denied=salary");
  }

  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    redirect("/tracker?denied=admin");
  }

  return profile;
}

export function canAccessSalary(profile: Profile): boolean {
  return profile.can_access_salary || profile.role === "admin";
}

import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/domain/database.types";

/**
 * The signed-in user's profile, or a redirect to /login.
 *
 * Loaded once per request in the app layout and passed down, so the nav and
 * the per-section gates below share a single query.
 */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Distinct from "deactivated": the auth user exists but has no profiles row,
  // or RLS is hiding it. Both are setup faults rather than a member being
  // switched off, and telling them apart matters when diagnosing.
  if (error || !profile) {
    console.error("[auth] no readable profile row", {
      userId: user.id,
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
}

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

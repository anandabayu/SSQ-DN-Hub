import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Editing and removing accounts.
 *
 * Email and password live in `auth.users`, which the anon key cannot touch, so
 * both need the service role here. Alias, Discord ID and the permission flags
 * live in `profiles` and are handled by server actions under RLS instead —
 * only what genuinely requires elevation goes through this route.
 *
 * The service role bypasses RLS entirely, so authorising the caller is this
 * route's own job.
 */

const UpdateSchema = z
  .object({
    email: z.email().optional(),
    password: z.string().min(8, "Password must be at least 8 characters.").optional(),
  })
  .refine((v) => v.email || v.password, {
    message: "Nothing to update.",
  });

/** Returns the caller's profile if they are an active admin, else null. */
async function requireAdminCaller() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const callerId = claimsData?.claims?.sub;
  if (!callerId) return null;

  // Read through RLS, not the admin client — "who is calling" should be
  // subject to the same rules as everything else.
  const { data: caller } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", callerId)
    .single();

  if (!caller || !caller.is_active || caller.role !== "admin") return null;
  return caller;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const caller = await requireAdminCaller();
  if (!caller) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { userId } = await ctx.params;

  const parsed = UpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, parsed.data);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const caller = await requireAdminCaller();
  if (!caller) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { userId } = await ctx.params;

  // An admin deleting themselves would drop their own session mid-request and
  // could leave the guild with no admin at all.
  if (userId === caller.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Refuse to remove the last remaining admin, for the same reason.
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (target?.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "That is the last admin — promote someone else first." },
        { status: 400 },
      );
    }
  }

  // Deleting the auth user cascades to profiles, and from there to the user's
  // characters, activities and completions. Parties they created survive:
  // runs.created_by is `on delete set null`.
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

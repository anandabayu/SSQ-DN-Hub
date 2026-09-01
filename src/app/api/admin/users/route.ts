import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CreateUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  alias: z.string().trim().min(1).max(30),
  discordId: z.string().trim().max(24).optional().default(""),
  role: z.enum(["admin", "member"]).default("member"),
  canAccessSalary: z.boolean().default(false),
});

/**
 * Creates a user. This is the one operation the anon key genuinely cannot do:
 * `signUp` from the browser would swap the admin's own session for the new
 * user's, so it has to run here with the service role.
 *
 * The service role bypasses RLS entirely, which means authorisation is this
 * route's job — hence the explicit admin check before anything else.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Read the caller's own profile through RLS, not the admin client — this
  // asks "who is the caller", and should be subject to the same rules.
  const { data: caller } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!caller || !caller.is_active || caller.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = CreateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { email, password, alias, discordId, role, canAccessSalary } =
    parsed.data;

  const admin = createAdminClient();

  // The profiles row is written by the on_auth_user_created trigger, which
  // reads these metadata fields.
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      alias,
      discord_id: discordId,
      role,
      can_access_salary: canAccessSalary,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

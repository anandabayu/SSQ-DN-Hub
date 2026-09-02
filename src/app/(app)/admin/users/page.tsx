import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui";
import type { Profile } from "@/lib/domain/database.types";

import { CreateUserForm } from "./create-user-form";
import { UserRow } from "./user-row";

export const metadata = { title: "Users — SSQ DN Hub" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("role")
    .order("alias");

  // Sign-in emails live in auth.users, which only the service role can read.
  // This page is already admin-gated, and the emails never leave it except as
  // the value of each row's edit field.
  const emails = new Map<string, string>();
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({
      perPage: 1000,
    });
    for (const user of data?.users ?? []) {
      if (user.email) emails.set(user.id, user.email);
    }
  } catch (cause) {
    // Missing service role key: the page still works, minus email editing.
    console.error("[admin] could not list auth users", cause);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-fg-dim">
          Create accounts and grant Salary access. There is no self-signup.
        </p>
      </div>

      <CreateUserForm />

      <Card title={`All users (${profiles?.length ?? 0})`}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-xs tracking-wider text-fg-dim uppercase">
                <th className="pb-2 text-left font-semibold">Alias</th>
                <th className="pb-2 text-left font-semibold">Discord ID</th>
                <th className="pb-2 text-center font-semibold">Role</th>
                <th className="pb-2 text-center font-semibold">Salary</th>
                <th className="pb-2 text-center font-semibold">Active</th>
                <th className="pb-2 text-right font-semibold">Account</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((profile) => (
                <UserRow
                  key={profile.id}
                  profile={profile as Profile}
                  email={emails.get(profile.id) ?? null}
                  isSelf={profile.id === admin.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

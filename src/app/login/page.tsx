import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-gold to-[#f5d98a] bg-clip-text text-2xl font-bold text-transparent">
            SSQ DN Hub
          </h1>
          <p className="mt-1 text-sm text-fg-dim">
            Stream Squad &mdash; Dragon Nest
          </p>
        </header>

        {error === "inactive" && (
          <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            That account has been deactivated. Ask an admin to re-enable it.
          </p>
        )}

        {error === "no_profile" && (
          <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            Signed in, but this account has no profile row. See the server log —
            the account may predate the database setup.
          </p>
        )}

        <Suspense>
          <LoginForm next={next} />
        </Suspense>

        <p className="mt-6 text-center text-xs text-fg-dim">
          Accounts are created by an admin. Ask in Discord if you need one.
        </p>
      </div>
    </main>
  );
}

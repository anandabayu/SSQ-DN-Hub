import { canAccessSalary, requireProfile } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Loaded once here and threaded into the nav, so the per-section gates in
  // salary/ and admin/ reuse the request cache rather than re-querying.
  const profile = await requireProfile();

  // Width: fills the viewport with padding on small screens, then switches to
  // a percentage of it once there is enough room to beat the old fixed cap —
  // a flat percentage would make mid-size laptops narrower than before. The
  // upper bound keeps line lengths sane on very wide monitors.
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-5 sm:px-6 2xl:w-4/5 2xl:max-w-[1800px]">
      <AppNav
        alias={profile.alias}
        isAdmin={profile.role === "admin"}
        showSalary={canAccessSalary(profile)}
      />
      <main className="flex-1 pt-6 pb-12">{children}</main>
    </div>
  );
}

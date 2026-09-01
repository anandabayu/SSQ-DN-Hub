import { requireSalaryAccess } from "@/lib/auth";

/**
 * Redirect gate for the whole Salary section. This is UX only — a user who
 * calls the Supabase REST API directly still gets nothing, because every
 * salary table requires has_salary_access() in its policy.
 */
export default async function SalaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSalaryAccess();
  return <>{children}</>;
}

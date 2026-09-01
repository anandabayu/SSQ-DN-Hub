"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/brand";

/**
 * Tracker and Calculator are always present. Salary appears only with the
 * can_access_salary flag and Users only for admins — but hiding a link is
 * cosmetic. What actually stops a member reaching salary data is RLS.
 */
export function AppNav({
  alias,
  isAdmin,
  showSalary,
}: {
  alias: string;
  isAdmin: boolean;
  showSalary: boolean;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/tracker", label: "Tracker" },
    { href: "/calculator", label: "Calculator" },
    ...(showSalary ? [{ href: "/salary", label: "Salary" }] : []),
    ...(isAdmin
      ? [
          { href: "/admin/users", label: "Users" },
          { href: "/admin/webhooks", label: "Webhooks" },
        ]
      : []),
  ];

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line pb-4">
      <Link href="/tracker" className="flex shrink-0 items-center gap-2">
        <Logo className="h-9 w-auto" />
        <span className="hidden bg-gradient-to-r from-gold to-[#f5d98a] bg-clip-text text-lg font-bold text-transparent sm:inline">
          SSQ DN Hub
        </span>
      </Link>

      <nav className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
        {links.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={[
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/20 text-fg"
                  : "text-fg-dim hover:bg-panel-2 hover:text-fg",
              ].join(" ")}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-sm text-fg-dim sm:inline">{alias}</span>
        <form action={signOut}>
          <button
            type="submit"
            className="cursor-pointer text-sm text-fg-dim transition-colors hover:text-danger"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

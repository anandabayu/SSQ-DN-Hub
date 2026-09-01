import type { ComponentProps, ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const VARIANTS = {
  default: "border-line bg-panel-2 text-fg hover:border-gold hover:text-gold",
  primary: "border-accent-dim bg-accent/20 text-fg hover:bg-accent/30",
  danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
  success: "border-success/40 bg-success/10 text-success hover:bg-success/20",
  ghost: "border-transparent bg-transparent text-fg-dim hover:text-fg",
} as const;

export function Button({
  variant = "default",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3.5 py-2",
        "text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-fg",
        "placeholder:text-fg-dim/60",
        "focus:border-gold focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cx(
        "rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-fg",
        "focus:border-gold focus:outline-none",
        className,
      )}
    />
  );
}

export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-line bg-panel/80 backdrop-blur-sm",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold tracking-wide text-fg uppercase">
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-fg-dim">
      {children}
    </p>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm",
        tone === "warning"
          ? "border-gold/50 bg-gold/10 text-gold"
          : "border-accent-dim bg-accent/10 text-fg",
      )}
    >
      {children}
    </div>
  );
}

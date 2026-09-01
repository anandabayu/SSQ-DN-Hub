import type { Profile } from "@/lib/domain/database.types";

import { setActive, setRole, setSalaryAccess } from "./actions";

function Toggle({
  action,
  id,
  value,
  onLabel,
  offLabel,
  disabled,
  tone = "accent",
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  value: boolean;
  onLabel: string;
  offLabel: string;
  disabled?: boolean;
  tone?: "accent" | "success";
}) {
  const activeTone =
    tone === "success"
      ? "border-success/40 bg-success/15 text-success"
      : "border-accent-dim bg-accent/20 text-fg";

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="value" value={String(!value)} />
      <button
        type="submit"
        disabled={disabled}
        className={[
          "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-40",
          value ? activeTone : "border-line bg-panel-2 text-fg-dim",
        ].join(" ")}
      >
        {value ? onLabel : offLabel}
      </button>
    </form>
  );
}

export function UserRow({
  profile,
  isSelf,
}: {
  profile: Profile;
  isSelf: boolean;
}) {
  return (
    <tr className="border-t border-line transition-colors hover:bg-panel-2/60">
      <td className="py-2.5">
        {profile.alias}
        {isSelf && <span className="ml-1.5 text-xs text-fg-dim">(you)</span>}
      </td>
      <td className="py-2.5 text-fg-dim">{profile.discord_id || "—"}</td>

      <td className="py-2.5 text-center">
        <form action={setRole} className="inline">
          <input type="hidden" name="id" value={profile.id} />
          <input
            type="hidden"
            name="value"
            value={profile.role === "admin" ? "member" : "admin"}
          />
          <button
            type="submit"
            // An admin demoting themselves would lock the guild out of user
            // management, so that one path is blocked in the UI and again in
            // the action.
            disabled={isSelf}
            title={isSelf ? "You cannot change your own role" : undefined}
            className={[
              "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-40",
              profile.role === "admin"
                ? "border-gold/40 bg-gold/15 text-gold"
                : "border-line bg-panel-2 text-fg-dim",
            ].join(" ")}
          >
            {profile.role}
          </button>
        </form>
      </td>

      <td className="py-2.5 text-center">
        <Toggle
          action={setSalaryAccess}
          id={profile.id}
          value={profile.can_access_salary || profile.role === "admin"}
          disabled={profile.role === "admin"}
          onLabel="granted"
          offLabel="no access"
        />
      </td>

      <td className="py-2.5 text-center">
        <Toggle
          action={setActive}
          id={profile.id}
          value={profile.is_active}
          disabled={isSelf}
          tone="success"
          onLabel="active"
          offLabel="disabled"
        />
      </td>
    </tr>
  );
}

"use client";

import { useRouter } from "next/navigation";

import { Button, Select } from "@/components/ui";
import { shiftWeek, weekOf } from "@/lib/domain/week";

/**
 * Week navigation, plus the admin-only user picker.
 *
 * The picker defaults to whoever is signed in. It is rendered for admins only,
 * but that is presentation — the tracker policies are what actually decide who
 * can read whose rows.
 */
export function TrackerToolbar({
  week,
  isAdmin,
  currentUserId,
  targetUserId,
  members,
}: {
  week: string;
  isAdmin: boolean;
  currentUserId: string;
  targetUserId: string;
  members: { id: string; alias: string }[];
}) {
  const router = useRouter();

  function go(next: { user?: string; week?: string }) {
    const params = new URLSearchParams();
    const user = next.user ?? targetUserId;
    const targetWeek = next.week ?? week;

    if (user !== currentUserId) params.set("user", user);
    if (targetWeek !== weekOf()) params.set("week", targetWeek);

    const query = params.toString();
    router.push(query ? `/tracker?${query}` : "/tracker");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && members.length > 0 && (
        <Select
          value={targetUserId}
          onChange={(e) => go({ user: e.target.value })}
          aria-label="View tracker for user"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.id === currentUserId ? `${member.alias} (you)` : member.alias}
            </option>
          ))}
        </Select>
      )}

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => go({ week: shiftWeek(week, -1) })}
          aria-label="Previous week"
        >
          &larr;
        </Button>
        <Button variant="ghost" onClick={() => go({ week: weekOf() })}>
          This week
        </Button>
        <Button
          variant="ghost"
          onClick={() => go({ week: shiftWeek(week, 1) })}
          aria-label="Next week"
        >
          &rarr;
        </Button>
      </div>
    </div>
  );
}

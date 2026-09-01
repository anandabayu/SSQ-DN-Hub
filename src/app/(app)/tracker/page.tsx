import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatWeekRange, isCurrentWeek, weekOf } from "@/lib/domain/week";
import { Banner, Card, EmptyState } from "@/components/ui";
import type { Activity, Character, Completion } from "@/lib/domain/database.types";

import { TrackerGrid } from "./tracker-grid";
import { TrackerToolbar } from "./tracker-toolbar";
import { AddForms } from "./add-forms";

export const metadata = { title: "Tracker — SSQ DN Hub" };

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; week?: string; denied?: string }>;
}) {
  const { user: requestedUser, week: requestedWeek, denied } = await searchParams;

  const profile = await requireProfile();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  // Only admins may target another user. A member who hand-edits ?user= is
  // ignored here — and even if they weren't, RLS returns them nothing.
  const targetUserId =
    isAdmin && requestedUser ? requestedUser : profile.id;
  const viewingOther = targetUserId !== profile.id;

  const week = requestedWeek ?? weekOf();

  const [characters, activities, completions, members, targetProfile] =
    await Promise.all([
      supabase
        .from("characters")
        .select("*")
        .eq("user_id", targetUserId)
        .order("sort_order"),
      supabase
        .from("activities")
        .select("*")
        .eq("user_id", targetUserId)
        .order("sort_order"),
      supabase
        .from("completions")
        .select("*")
        .eq("user_id", targetUserId)
        .eq("week_of", week),
      isAdmin
        ? supabase
            .from("profiles")
            .select("id, alias")
            .eq("is_active", true)
            .order("alias")
        : Promise.resolve({ data: null }),
      viewingOther
        ? supabase.from("profiles").select("alias").eq("id", targetUserId).single()
        : Promise.resolve({ data: null }),
    ]);

  const doneKeys = new Set(
    ((completions.data ?? []) as Completion[])
      .filter((c) => c.done)
      .map((c) => `${c.character_id}:${c.activity_id}`),
  );

  return (
    <div className="space-y-4">
      {denied === "salary" && (
        <Banner tone="warning">
          You don&apos;t have access to the Salary section. Ask an admin to
          enable it.
        </Banner>
      )}
      {denied === "admin" && (
        <Banner tone="warning">That section is admin-only.</Banner>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Weekly Tracker</h1>
          <p className="mt-1 text-sm text-fg-dim">
            {formatWeekRange(week)}
            {isCurrentWeek(week) ? " · this week" : ""}
          </p>
        </div>

        <TrackerToolbar
          week={week}
          isAdmin={isAdmin}
          currentUserId={profile.id}
          targetUserId={targetUserId}
          members={(members.data ?? []) as { id: string; alias: string }[]}
        />
      </div>

      {viewingOther && (
        <Banner tone="warning">
          <span aria-hidden>👁</span>
          Viewing{" "}
          <strong>{targetProfile.data?.alias ?? "another user"}</strong>&apos;s
          tracker. This is read-only — you cannot change their progress.
        </Banner>
      )}

      <Card>
        {(characters.data ?? []).length === 0 ||
        (activities.data ?? []).length === 0 ? (
          <EmptyState>
            {viewingOther
              ? "This user hasn't set up any characters or activities yet."
              : "Add a character and an activity below to start tracking."}
          </EmptyState>
        ) : (
          <TrackerGrid
            characters={(characters.data ?? []) as Character[]}
            activities={(activities.data ?? []) as Activity[]}
            doneKeys={[...doneKeys]}
            week={week}
            readOnly={viewingOther}
          />
        )}
      </Card>

      {!viewingOther && <AddForms />}
    </div>
  );
}

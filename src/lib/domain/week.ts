/**
 * Weekly reset handling for the tracker.
 *
 * A tracker week runs Saturday to Friday, because the nest reset lands at
 * Saturday 08:00 game time. Anything logged between Saturday 00:00 and 07:59
 * still belongs to the *previous* week — the nests haven't reset yet.
 *
 * The reset instant is computed in a fixed game timezone rather than the
 * machine's local time. Server components render on the host's clock (UTC on
 * Vercel) while the toolbar runs in the player's browser; without a fixed
 * frame those two disagree about which week "now" is, and the grid renders one
 * week while the toolbar highlights another.
 *
 * A week is identified by the date of its Saturday, e.g. "2026-09-05".
 */

/** Dragon Nest SEA server time. */
const GAME_UTC_OFFSET_HOURS = 7;

/** Saturday 08:00 game time. */
const RESET_HOUR = 8;
const RESET_DAY = 6; // 0 = Sunday … 6 = Saturday

const HOUR_MS = 3_600_000;

/** The Saturday that begins the reset week containing `date`. */
export function weekOf(date: Date = new Date()): string {
  // Shift into game time, then back off the reset hour, so that midnight in
  // the shifted frame lines up exactly with the Saturday 08:00 reset. After
  // this, plain UTC getters give the right answer.
  const shifted = new Date(
    date.getTime() + GAME_UTC_OFFSET_HOURS * HOUR_MS - RESET_HOUR * HOUR_MS,
  );

  const daysSinceReset = (shifted.getUTCDay() - RESET_DAY + 7) % 7;
  shifted.setUTCDate(shifted.getUTCDate() - daysSinceReset);

  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

export function shiftWeek(weekKey: string, weeks: number): string {
  const d = fromDateString(weekKey);
  d.setDate(d.getDate() + weeks * 7);
  return toDateString(d);
}

export function isCurrentWeek(weekKey: string): boolean {
  return weekKey === weekOf();
}

/** e.g. "Sat 5 Sep - Fri 11 Sep 2026" */
export function formatWeekRange(weekKey: string): string {
  const start = fromDateString(weekKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const day = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  return `${day(start)} - ${day(end)} ${end.getFullYear()}`;
}

function toDateString(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function fromDateString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  // Constructed in local time: `new Date("2026-09-05")` parses as UTC and can
  // land on the previous day west of Greenwich. Only whole days are added to
  // this, so no timezone drift creeps in.
  return new Date(year, month - 1, day);
}

import { describe, expect, it } from "vitest";

import { formatWeekRange, shiftWeek, weekOf } from "./week";

/**
 * Game time is UTC+7 and the reset is Saturday 08:00, so the boundary sits at
 * Saturday 01:00 UTC. These cases are written in UTC to pin that down
 * regardless of the machine running the tests.
 */
const utc = (iso: string) => new Date(`${iso}Z`);

describe("weekOf", () => {
  it("starts the week on Saturday", () => {
    // Sat 2026-09-05 09:00 game time = 02:00 UTC, just after reset.
    expect(weekOf(utc("2026-09-05T02:00:00"))).toBe("2026-09-05");
  });

  it("keeps Saturday before 08:00 game time in the previous week", () => {
    // Sat 2026-09-05 07:00 game time = 00:00 UTC — nests have not reset yet.
    expect(weekOf(utc("2026-09-05T00:00:00"))).toBe("2026-08-29");
  });

  it("rolls over exactly at the reset", () => {
    // 07:59 game time (00:59 UTC) is the old week; 08:00 (01:00 UTC) is new.
    expect(weekOf(utc("2026-09-05T00:59:00"))).toBe("2026-08-29");
    expect(weekOf(utc("2026-09-05T01:00:00"))).toBe("2026-09-05");
  });

  it("holds the same week key from Saturday through Friday", () => {
    const expected = "2026-09-05";
    expect(weekOf(utc("2026-09-05T01:00:00"))).toBe(expected); // Sat, post-reset
    expect(weekOf(utc("2026-09-07T12:00:00"))).toBe(expected); // Monday
    expect(weekOf(utc("2026-09-10T12:00:00"))).toBe(expected); // Thursday
    expect(weekOf(utc("2026-09-11T23:00:00"))).toBe(expected); // Friday night
  });

  it("moves to the next week once the following Saturday reset passes", () => {
    expect(weekOf(utc("2026-09-12T00:30:00"))).toBe("2026-09-05"); // pre-reset
    expect(weekOf(utc("2026-09-12T01:30:00"))).toBe("2026-09-12"); // post-reset
  });

  it("crosses a month boundary correctly", () => {
    // Sat 2026-10-03 is the first reset of October.
    expect(weekOf(utc("2026-10-02T12:00:00"))).toBe("2026-09-26");
    expect(weekOf(utc("2026-10-03T02:00:00"))).toBe("2026-10-03");
  });
});

describe("shiftWeek", () => {
  it("steps a whole week in either direction", () => {
    expect(shiftWeek("2026-09-05", 1)).toBe("2026-09-12");
    expect(shiftWeek("2026-09-05", -1)).toBe("2026-08-29");
  });

  it("crosses a year boundary", () => {
    expect(shiftWeek("2026-12-26", 1)).toBe("2027-01-02");
  });
});

describe("formatWeekRange", () => {
  it("renders Saturday through Friday", () => {
    // Month abbreviations come from ICU and vary ("Sep" vs "Sept"), so assert
    // the parts that matter rather than the exact spelling.
    const range = formatWeekRange("2026-09-05");
    expect(range).toMatch(/^Sat 5 Sep/);
    expect(range).toMatch(/Fri 11 Sep\w* 2026$/);
  });
});

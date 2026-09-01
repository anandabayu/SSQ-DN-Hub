import { describe, expect, it } from "vitest";

import {
  computePlayerPayout,
  computeProgress,
  computeResidue,
  computeTotals,
  computeUnsharedGold,
  formatGold,
} from "./money";

const settings = { ssPrice: 4, taxPerTrade: 1 };

const player = (ssUsed: number, paid = false) => ({ ssUsed, paid });
const loot = (soldPrice: number, sold = true) => ({ soldPrice, sold });

describe("computeTotals", () => {
  it("splits a clean run evenly", () => {
    const players = [player(0), player(0), player(0), player(0)];
    const items = [loot(1000), loot(1000)];

    expect(computeTotals(settings, players, items)).toEqual({
      totalSold: 2000,
      totalReimb: 0,
      remaining: 2000,
      evenShare: 500,
    });
  });

  it("reimburses seal stamps before splitting", () => {
    const players = [player(10), player(0), player(0), player(0)];
    const items = [loot(1000)];

    // 10 SS * 4g = 40g back to the first player, leaving 960 to split 4 ways.
    expect(computeTotals(settings, players, items)).toEqual({
      totalSold: 1000,
      totalReimb: 40,
      remaining: 960,
      evenShare: 240,
    });
  });

  it("floors the even share rather than distributing fractions", () => {
    const players = [player(0), player(0), player(0)];
    const items = [loot(100)];

    const totals = computeTotals(settings, players, items);
    expect(totals.evenShare).toBe(33);
    expect(computeResidue(players, totals)).toBe(1);
  });

  it("returns zero share for an empty party without dividing by zero", () => {
    const totals = computeTotals(settings, [], [loot(500)]);
    expect(totals.evenShare).toBe(0);
    expect(Number.isNaN(totals.evenShare)).toBe(false);
  });

  it("treats missing and non-numeric values as zero", () => {
    const players = [player(Number.NaN), player(0)];
    const items = [loot(Number.NaN), loot(100)];

    expect(computeTotals(settings, players, items)).toEqual({
      totalSold: 100,
      totalReimb: 0,
      remaining: 100,
      evenShare: 50,
    });
  });

  it("floors toward negative infinity when a run loses gold", () => {
    // Reimbursements exceed sales: 2 players * 10 SS * 4g = 80g owed on 50g.
    const players = [player(10), player(10)];
    const totals = computeTotals(settings, players, [loot(50)]);

    expect(totals.remaining).toBe(-30);
    expect(totals.evenShare).toBe(-15);
  });
});

describe("computePlayerPayout", () => {
  it("adds reimbursement to the share and deducts trade tax last", () => {
    const players = [player(10), player(0), player(0), player(0)];
    const totals = computeTotals(settings, players, [loot(1000)]);

    // Share 240 + reimbursement 40 - tax 1
    expect(computePlayerPayout(settings, players[0], totals)).toEqual({
      reimb: 40,
      finalTotal: 279,
    });
    // Share 240 + reimbursement 0 - tax 1
    expect(computePlayerPayout(settings, players[1], totals)).toEqual({
      reimb: 0,
      finalTotal: 239,
    });
  });

  it("keeps trade tax out of the shared pot", () => {
    const players = [player(0), player(0)];
    const totals = computeTotals(settings, players, [loot(1000)]);

    // Tax reduces individual payouts only - the pot still split 500 each.
    expect(totals.evenShare).toBe(500);
    expect(computePlayerPayout(settings, players[0], totals).finalTotal).toBe(499);
  });
});

describe("computeUnsharedGold", () => {
  it("counts only players not yet marked paid", () => {
    const players = [player(0, true), player(0, false), player(0, false)];
    const totals = computeTotals(settings, players, [loot(300)]);

    // evenShare 100, minus 1 tax = 99 each; two unpaid.
    expect(computeUnsharedGold(settings, players, totals)).toBe(198);
  });

  it("is zero once everyone is paid", () => {
    const players = [player(0, true), player(0, true)];
    const totals = computeTotals(settings, players, [loot(300)]);

    expect(computeUnsharedGold(settings, players, totals)).toBe(0);
  });
});

describe("computeProgress", () => {
  it("counts sold loot and paid players", () => {
    expect(
      computeProgress(
        [player(0, true), player(0, false)],
        [loot(1, true), loot(1, false), loot(1, true)],
      ),
    ).toEqual({ lootSold: 2, lootTotal: 3, playersPaid: 1, playersTotal: 2 });
  });
});

describe("formatGold", () => {
  it("groups thousands and trims trailing zeros", () => {
    expect(formatGold(1234567)).toBe("1,234,567");
    expect(formatGold(1234.5)).toBe("1,234.5");
    expect(formatGold(Number.NaN)).toBe("0");
  });
});

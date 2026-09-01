/**
 * Raid loot settlement math, ported 1:1 from the original DN Salary app.
 *
 * Kept as pure functions with no React and no Supabase so it can be unit
 * tested - this is the only code in the app that decides how much gold a real
 * person is owed, so it is the only code that genuinely needs tests.
 *
 * Rounding is deliberately `Math.floor` at every step, matching the original.
 * Two consequences worth knowing:
 *   - Floor truncates toward negative infinity, so a party that lost gold
 *     (reimbursements exceeding sales) rounds *away* from zero, not toward it.
 *   - Flooring the even share means a few gold can be left unallocated. That
 *     residue is reported by `computeResidue` rather than silently vanishing,
 *     which the original app never surfaced.
 */

export interface RunSettings {
  ssPrice: number;
  taxPerTrade: number;
}

export interface RunPlayerLike {
  ssUsed: number;
  paid: boolean;
}

export interface LootItemLike {
  soldPrice: number;
}

export interface RunTotals {
  /** Gold from every loot item, floored. */
  totalSold: number;
  /** Gold returned to players for the seal stamps they burned. */
  totalReimb: number;
  /** What is left to split evenly once everyone is reimbursed. */
  remaining: number;
  /** Each player's cut of `remaining`, floored. */
  evenShare: number;
}

export interface PlayerPayout {
  /** This player's seal stamp reimbursement. */
  reimb: number;
  /** What they actually receive: share + reimbursement - trade tax. */
  finalTotal: number;
}

/** Gold is never fractional in game. */
export function floorGold(n: number): number {
  return Math.floor(n);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function computeTotals(
  settings: RunSettings,
  players: readonly RunPlayerLike[],
  lootItems: readonly LootItemLike[],
): RunTotals {
  let totalSold = 0;
  for (const item of lootItems) {
    totalSold += toNumber(item.soldPrice);
  }
  totalSold = floorGold(totalSold);

  const ssPrice = toNumber(settings.ssPrice);

  // Floored per player rather than on the sum, so each player's reimbursement
  // matches what they are individually shown.
  let totalReimb = 0;
  for (const player of players) {
    totalReimb += floorGold(toNumber(player.ssUsed) * ssPrice);
  }

  const remaining = totalSold - totalReimb;
  const evenShare =
    players.length > 0 ? floorGold(remaining / players.length) : 0;

  return { totalSold, totalReimb, remaining, evenShare };
}

/**
 * The per-trade tax is subtracted last and never enters the shared pot: it is
 * gold burned sending a share to another player, so it only reduces what that
 * individual receives.
 */
export function computePlayerPayout(
  settings: RunSettings,
  player: RunPlayerLike,
  totals: RunTotals,
): PlayerPayout {
  const reimb = floorGold(toNumber(player.ssUsed) * toNumber(settings.ssPrice));
  const tax = toNumber(settings.taxPerTrade);
  const finalTotal = floorGold(totals.evenShare + reimb - tax);

  return { reimb, finalTotal };
}

/** Total still owed to players not yet marked paid. */
export function computeUnsharedGold(
  settings: RunSettings,
  players: readonly RunPlayerLike[],
  totals: RunTotals,
): number {
  let sum = 0;
  for (const player of players) {
    if (!player.paid) {
      sum += computePlayerPayout(settings, player, totals).finalTotal;
    }
  }
  return sum;
}

/**
 * Gold left over because `evenShare` was floored - between 0 and
 * (playerCount - 1). The original app dropped this on the floor without
 * telling anyone; surfacing it lets whoever is distributing decide where the
 * odd gold goes.
 */
export function computeResidue(
  players: readonly RunPlayerLike[],
  totals: RunTotals,
): number {
  if (players.length === 0) return totals.remaining;
  return totals.remaining - totals.evenShare * players.length;
}

export interface RunProgress {
  lootSold: number;
  lootTotal: number;
  playersPaid: number;
  playersTotal: number;
}

export function computeProgress(
  players: readonly { paid: boolean }[],
  lootItems: readonly { sold: boolean }[],
): RunProgress {
  return {
    lootSold: lootItems.filter((i) => i.sold).length,
    lootTotal: lootItems.length,
    playersPaid: players.filter((p) => p.paid).length,
    playersTotal: players.length,
  };
}

const goldFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatGold(n: number): string {
  if (!Number.isFinite(n)) n = 0;
  return goldFormatter.format(Math.round(n * 100) / 100);
}

/**
 * Discord message builders, ported from the DN Salary app.
 *
 * All three messages are **embeds**, with the player mentions carried in
 * `content` above them — that is the format the guild is used to reading, so
 * it is reproduced here field for field.
 *
 * Pure string/JSON construction with no fetch and no secrets — the webhook URL
 * is resolved separately, server-side, and never reaches this module.
 */

import {
  computePlayerPayout,
  computeProgress,
  computeTotals,
  formatGold,
  type RunSettings,
} from "./money";

export interface DiscordPlayer {
  name: string;
  ign: string;
  discord_id: string;
  ss_used: number;
  paid: boolean;
}

export interface DiscordLootItem {
  name: string;
  sold_price: number;
  sold: boolean;
}

export interface DiscordRun {
  name: string;
  ign: string;
  ss_price: number;
  tax_per_trade: number;
}

export type DiscordPayload = Record<string, unknown>;

const COLOR_ROSTER = 0x8b6fe0;
const COLOR_ITEMS = 0x5ecb8a;
const COLOR_SUMMARY = 0xe8b23d;

function toSettings(run: DiscordRun): RunSettings {
  return {
    ssPrice: Number(run.ss_price),
    taxPerTrade: Number(run.tax_per_trade),
  };
}

/** Discord snowflakes are 15-21 digits; anything else is a typo, not a user. */
export function isValidDiscordId(id: string): boolean {
  return /^\d{15,21}$/.test((id ?? "").trim());
}

/** Embed field values are capped at 1024 characters. */
export function truncateField(text: string, max = 1024): string {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function label(player: DiscordPlayer): string {
  return isValidDiscordId(player.discord_id)
    ? `<@${player.discord_id.trim()}>`
    : player.name || "Unnamed";
}

function ignLabel(player: DiscordPlayer): string {
  return player.ign ? player.ign : "_no IGN_";
}

/**
 * Mentions every player with a valid Discord ID, followed by the message.
 * `allowed_mentions` is restricted to exactly those ids, so a stray `@here`
 * typed into a player name can never ping the whole server.
 */
export function buildMentionContent(
  players: DiscordPlayer[],
  message: string,
): { content?: string; userIds: string[] } {
  const userIds = players
    .filter((p) => isValidDiscordId(p.discord_id))
    .map((p) => p.discord_id.trim());

  if (userIds.length === 0) return { content: undefined, userIds: [] };

  return {
    content: `${userIds.map((id) => `<@${id}>`).join(" ")} ${message}`,
    userIds,
  };
}

function withMentions(
  payload: DiscordPayload,
  players: DiscordPlayer[],
  message: string,
): DiscordPayload {
  const mention = buildMentionContent(players, message);
  if (!mention.content) return payload;

  return {
    ...payload,
    content: mention.content,
    allowed_mentions: { parse: [], users: mention.userIds },
  };
}

export function buildLootLinesText(items: DiscordLootItem[]): string {
  if (items.length === 0) return "_No loot items_";

  return items
    .map(
      (item) =>
        `${item.sold ? "✅" : "💎"} ${item.name || "Unnamed item"} — ${formatGold(
          Number(item.sold_price),
        )} g`,
    )
    .join("\n");
}

/** Forum thread name, as the original built it: "IGN - Party name". */
export function buildThreadName(run: DiscordRun): string {
  return `${run.ign} - ${run.name}`.slice(0, 100);
}

export function buildRosterMessage(
  run: DiscordRun,
  players: DiscordPlayer[],
  items: DiscordLootItem[],
): DiscordPayload {
  const playersText =
    players.length === 0
      ? "_No players yet_"
      : players
          .map(
            (p) =>
              `${label(p)} - ${ignLabel(p)} : ${Number(p.ss_used) || 0} SS`,
          )
          .join("\n");

  const payload: DiscordPayload = {
    embeds: [
      {
        title: run.name + (run.ign ? ` — ${run.ign}` : ""),
        color: COLOR_ROSTER,
        description: "Raid roster, seal stamp usage & loot so far",
        fields: [
          { name: "Players", value: truncateField(playersText) },
          { name: "Loot Items", value: truncateField(buildLootLinesText(items)) },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return withMentions(
    payload,
    players,
    "— raid roster, here's who's in and seal stamps used so far:",
  );
}

export function buildItemUpdateMessage(
  run: DiscordRun,
  players: DiscordPlayer[],
  items: DiscordLootItem[],
): DiscordPayload {
  const payload: DiscordPayload = {
    embeds: [
      {
        title: run.name + (run.ign ? ` — ${run.ign}` : ""),
        color: COLOR_ITEMS,
        description: "Loot item status update",
        fields: [
          { name: "Loot Items", value: truncateField(buildLootLinesText(items)) },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return withMentions(payload, players, "— loot item status update:");
}

export function buildSummaryEmbed(
  run: DiscordRun,
  players: DiscordPlayer[],
  items: DiscordLootItem[],
): DiscordPayload {
  const settings = toSettings(run);
  const playerLikes = players.map((p) => ({
    ssUsed: Number(p.ss_used),
    paid: p.paid,
  }));

  const totals = computeTotals(
    settings,
    playerLikes,
    items.map((i) => ({ soldPrice: Number(i.sold_price) })),
  );
  const progress = computeProgress(
    playerLikes,
    items.map((i) => ({ sold: i.sold })),
  );

  const payoutText =
    players.length === 0
      ? "_No players_"
      : players
          .map((player) => {
            const payout = computePlayerPayout(
              settings,
              { ssUsed: Number(player.ss_used), paid: player.paid },
              totals,
            );
            const ssNote = Number(player.ss_used)
              ? ` (incl. ${player.ss_used}ss)`
              : "";
            return `${player.paid ? "✅" : "💎"} ${label(player)} - ${ignLabel(
              player,
            )} : ${formatGold(payout.finalTotal)}g${ssNote}`;
          })
          .join("\n");

  const payload: DiscordPayload = {
    embeds: [
      {
        title: `✅${run.name}${run.ign ? ` — ${run.ign}` : ""}`,
        color: COLOR_SUMMARY,
        fields: [
          {
            name: "Total Sold",
            value: `${formatGold(totals.totalSold)} g`,
            inline: true,
          },
          {
            name: "SS Reimbursed",
            value: `${formatGold(totals.totalReimb)} g`,
            inline: true,
          },
          {
            name: "Remaining Pot",
            value: `${formatGold(totals.remaining)} g`,
            inline: true,
          },
          {
            name: "Even Share/Player",
            value: `${formatGold(totals.evenShare)} g`,
            inline: true,
          },
          {
            name: "Loot Sold",
            value: `${progress.lootSold}/${progress.lootTotal}`,
            inline: true,
          },
          {
            name: "Gold Shared",
            value: `${progress.playersPaid}/${progress.playersTotal}`,
            inline: true,
          },
          { name: "Loot Items", value: truncateField(buildLootLinesText(items)) },
          { name: "Payouts", value: truncateField(payoutText) },
        ],
        footer: { text: `SS Price: ${formatGold(Number(run.ss_price))} g/stamp` },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return withMentions(payload, players, "— your raid loot summary is ready:");
}

/** Plain-text version for the Copy Summary button. */
export function buildSummaryText(
  run: DiscordRun,
  players: DiscordPlayer[],
  items: DiscordLootItem[],
): string {
  const settings = toSettings(run);
  const playerLikes = players.map((p) => ({
    ssUsed: Number(p.ss_used),
    paid: p.paid,
  }));
  const totals = computeTotals(
    settings,
    playerLikes,
    items.map((i) => ({ soldPrice: Number(i.sold_price) })),
  );

  const lines = [`${run.name}`, "", "Loot sold:"];

  for (const item of items) {
    lines.push(
      `  - ${item.name || "Unnamed item"}: ${formatGold(Number(item.sold_price))} g${
        item.sold ? " [SOLD]" : ""
      }`,
    );
  }

  lines.push("", `Total sold: ${formatGold(totals.totalSold)} g`);
  lines.push(`Reimbursed: ${formatGold(totals.totalReimb)} g`);
  lines.push(`Even share: ${formatGold(totals.evenShare)} g`, "", "Payouts:");

  for (const player of players) {
    const payout = computePlayerPayout(
      settings,
      { ssUsed: Number(player.ss_used), paid: player.paid },
      totals,
    );
    const ssNote = Number(player.ss_used)
      ? ` (incl. ${player.ss_used} SS = ${formatGold(payout.reimb)} g)`
      : "";
    lines.push(
      `  ${player.paid ? "[PAID]" : "[    ]"} ${player.name || "Player"}: ${formatGold(
        payout.finalTotal,
      )} g${ssNote}`,
    );
  }

  return lines.join("\n");
}

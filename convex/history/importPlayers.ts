/**
 * Import writes for real players and the franchise's first-season rosters. Players upsert on
 * their nflverse id; a player the franchise already captured from a box score under the same
 * name is adopted rather than duplicated.
 */
import { v } from "convex/values";
import { ageInSeason } from "../../shared/players/format";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";
import { vImportedPlayer, vImportedRosterEntry } from "./importValidators";
import { seasonForYear, teamIdsByAbbr } from "./importSeasons";

type Imported = (typeof vImportedPlayer)["type"];

export async function playerByNflverseId(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  nflverseId: string,
): Promise<Doc<"players"> | null> {
  return await ctx.db
    .query("players")
    .withIndex("by_franchiseId_and_nflverseId", (q) =>
      q.eq("franchiseId", franchiseId).eq("nflverseId", nflverseId),
    )
    .first();
}

/** The one captured (non-imported) player with this exact name, if there is exactly one. */
async function adoptable(ctx: MutationCtx, franchiseId: Id<"franchises">, displayName: string) {
  const named = await ctx.db
    .query("players")
    .withIndex("by_franchiseId_and_displayName", (q) =>
      q.eq("franchiseId", franchiseId).eq("displayName", displayName),
    )
    .take(3);
  const captured = named.filter((p) => p.nflverseId === undefined);
  return captured.length === 1 && named.length === 1 ? captured[0]! : null;
}

/** Fields the source leaves blank are dropped, so a refresh never erases what the owner filled in. */
function defined<T extends object>(fields: T): T {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
}

function bio(p: Imported, teams: Map<string, Id<"teams">>) {
  return defined({
    firstName: p.firstName,
    lastName: p.lastName,
    displayName: p.displayName,
    position: p.position,
    birthYear: p.birthYear,
    college: p.college,
    heightIn: p.heightIn,
    weightLb: p.weightLb,
    draft: p.draft && {
      year: p.draft.year,
      round: p.draft.round,
      pick: p.draft.pick,
      teamId: p.draft.teamAbbr ? teams.get(p.draft.teamAbbr) : undefined,
    },
    undrafted: p.undrafted,
    nflverseId: p.nflverseId,
    isReal: true,
    origin: "import" as const,
    retired: !p.active,
  });
}

export async function upsertPlayerRows(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  players: readonly Imported[],
): Promise<number> {
  const teams = await teamIdsByAbbr(ctx);
  for (const p of players) {
    const existing =
      (await playerByNflverseId(ctx, franchiseId, p.nflverseId)) ??
      (p.active ? await adoptable(ctx, franchiseId, p.displayName) : null);
    if (existing) {
      // An ESPN match the owner confirmed wins over the import's id.
      await ctx.db.patch("players", existing._id, { ...bio(p, teams), espnId: existing.espnId ?? p.espnId });
    } else {
      await ctx.db.insert("players", { franchiseId, ...bio(p, teams), espnId: p.espnId, aliases: [] });
    }
  }
  return players.length;
}

export const upsertPlayers = internalMutation({
  args: { franchiseId: v.id("franchises"), players: v.array(vImportedPlayer) },
  returns: v.number(),
  handler: (ctx, { franchiseId, players }) => upsertPlayerRows(ctx, franchiseId, players),
});

/** Real rosters for the franchise's first season. A player who already has an entry that season keeps it. */
export async function upsertRosterRows(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  entries: readonly (typeof vImportedRosterEntry)["type"][],
): Promise<number> {
  const franchise = must(await ctx.db.get("franchises", franchiseId), "Franchise");
  const season = await seasonForYear(ctx, franchiseId, franchise.startYear);
  if (!season) return 0;
  const teams = await teamIdsByAbbr(ctx);
  let inserted = 0;
  for (const row of entries) {
    const teamId = teams.get(row.teamAbbr);
    const player = await playerByNflverseId(ctx, franchiseId, row.nflverseId);
    if (!teamId || !player) continue;
    const existing = await ctx.db
      .query("rosterEntries")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", season._id))
      .first();
    if (existing) continue;
    await ctx.db.insert("rosterEntries", {
      franchiseId,
      seasonId: season._id,
      teamId,
      playerId: player._id,
      jersey: row.jersey,
      position: row.position,
      age: ageInSeason(player, season.year) ?? undefined,
      exp: row.exp,
      acquisition: row.drafted ? { type: "draft", year: season.year } : undefined,
      status: row.status,
    });
    inserted++;
  }
  return inserted;
}

export const upsertRosterEntries = internalMutation({
  args: { franchiseId: v.id("franchises"), entries: v.array(vImportedRosterEntry) },
  returns: v.number(),
  handler: (ctx, { franchiseId, entries }) => upsertRosterRows(ctx, franchiseId, entries),
});

/**
 * Import writes for real season totals (`source: "import"`), draft history and career rows.
 * Imported totals sit next to log-derived ones and never replace them (FEATURES.md 4.8).
 */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { positionGroupOf } from "../../shared/domain";
import { summarizeSeasons, type StatLine } from "../../shared/stats";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";
import { vStatSplit } from "../lib/validators";
import { recomputeCareer } from "../stats/recompute";
import { playerByNflverseId } from "./importPlayers";
import { seasonForYear, teamIdsByAbbr } from "./importSeasons";
import { vImportedDraftPick, vImportedStatRow } from "./importValidators";

/** A player's rows in one season: two splits, a team or two, both sources. */
const MAX_ROWS_PER_PLAYER_SEASON = 20;

type StatArgs = {
  franchiseId: Id<"franchises">;
  year: number;
  split: "regular" | "postseason";
  rows: readonly (typeof vImportedStatRow)["type"][];
};

export async function upsertStatRows(ctx: MutationCtx, { franchiseId, year, split, rows }: StatArgs) {
  const franchise = must(await ctx.db.get("franchises", franchiseId), "Franchise");
  const season = await seasonForYear(ctx, franchiseId, year);
  if (!season || year >= franchise.startYear) return 0;
  const teams = await teamIdsByAbbr(ctx);
  let written = 0;
  for (const row of rows) {
    const teamId = teams.get(row.teamAbbr);
    const player = await playerByNflverseId(ctx, franchiseId, row.nflverseId);
    if (!teamId || !player) continue;
    const existing = await ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", season._id))
      .take(MAX_ROWS_PER_PLAYER_SEASON);
    const imported = existing.filter((r) => r.source === "import" && r.split === split);
    const position = row.position ?? player.position;
    const summary = summarizeSeasons([
      { gamesPlayed: row.gamesPlayed, totals: row.totals as StatLine, thresholdCounts: {}, bests: {} },
    ]);
    const fields = {
      franchiseId,
      seasonId: season._id,
      playerId: player._id,
      teamId,
      source: "import" as const,
      split,
      position,
      positionGroup: positionGroupOf(position),
      ...summary,
    };
    const [keep, ...stale] = imported;
    // A row from an earlier run under another team (nflverse revised `recent_team`) is replaced.
    for (const row of stale) await ctx.db.delete("seasonPlayerStats", row._id);
    if (keep) await ctx.db.replace("seasonPlayerStats", keep._id, fields);
    else await ctx.db.insert("seasonPlayerStats", fields);
    written++;
  }
  return written;
}

export const upsertSeasonStats = internalMutation({
  args: {
    franchiseId: v.id("franchises"),
    year: v.number(),
    split: vStatSplit,
    rows: v.array(vImportedStatRow),
  },
  returns: v.number(),
  handler: (ctx, args) => upsertStatRows(ctx, args),
});

export async function upsertDraftRows(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  picks: readonly (typeof vImportedDraftPick)["type"][],
): Promise<number> {
  const teams = await teamIdsByAbbr(ctx);
  const seasons = new Map<number, Awaited<ReturnType<typeof seasonForYear>>>();
  let written = 0;
  for (const pick of picks) {
    if (!seasons.has(pick.year)) seasons.set(pick.year, await seasonForYear(ctx, franchiseId, pick.year));
    const season = seasons.get(pick.year);
    const teamId = teams.get(pick.teamAbbr);
    if (!season || !teamId) continue;
    const player = pick.nflverseId ? await playerByNflverseId(ctx, franchiseId, pick.nflverseId) : null;
    const existing = await ctx.db
      .query("draftPicks")
      .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", season._id).eq("overall", pick.overall))
      .first();
    const fields = {
      franchiseId,
      seasonId: season._id,
      round: pick.round,
      overall: pick.overall,
      teamId,
      playerId: player?._id ?? existing?.playerId,
      rawName: pick.name,
      position: pick.position,
      college: pick.college,
    };
    // Notes, trade notes and grades the owner added survive a refresh.
    if (existing) await ctx.db.patch("draftPicks", existing._id, fields);
    else await ctx.db.insert("draftPicks", fields);
    written++;
  }
  return written;
}

export const upsertDraftPicks = internalMutation({
  args: { franchiseId: v.id("franchises"), picks: v.array(vImportedDraftPick) },
  returns: v.number(),
  handler: (ctx, { franchiseId, picks }) => upsertDraftRows(ctx, franchiseId, picks),
});

/** Career rows for a page of imported players, rebuilt from their season rows. */
export const recomputeCareers = internalMutation({
  args: { franchiseId: v.id("franchises"), paginationOpts: paginationOptsValidator },
  returns: v.object({ continueCursor: v.string(), isDone: v.boolean(), count: v.number() }),
  handler: async (ctx, { franchiseId, paginationOpts }) => {
    const page = await ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_nflverseId", (q) =>
        q.eq("franchiseId", franchiseId).gt("nflverseId", ""),
      )
      .paginate(paginationOpts);
    for (const player of page.page) await recomputeCareer(ctx, player);
    return { continueCursor: page.continueCursor, isDone: page.isDone, count: page.page.length };
  },
});

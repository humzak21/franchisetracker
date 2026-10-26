/**
 * Import writes for pre-franchise seasons: the season rows (the user team's record) and every
 * team's standings. Upserts, so a refresh rewrites the same rows.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";
import { teamsById } from "../lib/franchise";
import { vImportedStanding } from "./importValidators";

export async function teamIdsByAbbr(ctx: MutationCtx): Promise<Map<string, Id<"teams">>> {
  return new Map([...(await teamsById(ctx)).values()].map((t) => [t.abbr, t._id]));
}

export async function seasonForYear(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  year: number,
): Promise<Doc<"seasons"> | null> {
  return await ctx.db
    .query("seasons")
    .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchiseId).eq("year", year))
    .unique();
}

type Standing = (typeof vImportedStanding)["type"];

/** One season row per year and 32 standings rows; franchise seasons are never touched. */
export async function writeSeasonRows(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  standings: readonly Standing[],
): Promise<number> {
  const franchise = must(await ctx.db.get("franchises", franchiseId), "Franchise");
  const teams = await teamIdsByAbbr(ctx);
  const years = [...new Set(standings.map((s) => s.year))].filter((y) => y < franchise.startYear);
  for (const year of years) {
    const rows = standings.filter((s) => s.year === year);
    const user = rows.find((s) => teams.get(s.teamAbbr) === franchise.userTeamId);
    const userRecord = user && {
      w: user.w,
      l: user.l,
      t: user.t,
      divisionRank: user.divisionRank,
      seed: user.seed,
      playoffResult: user.playoffResult,
    };
    const existing = await seasonForYear(ctx, franchiseId, year);
    const seasonId =
      existing?._id ?? (await ctx.db.insert("seasons", { franchiseId, year, status: "complete" }));
    await ctx.db.patch("seasons", seasonId, { status: "complete", userRecord });

    for (const row of rows) {
      const teamId = teams.get(row.teamAbbr);
      if (!teamId) continue;
      const { year: _year, teamAbbr: _abbr, ...record } = row;
      const fields = { franchiseId, seasonId, teamId, ...record, source: "import" as const };
      const standing = await ctx.db
        .query("standings")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
        .first();
      if (standing) await ctx.db.replace("standings", standing._id, fields);
      else await ctx.db.insert("standings", fields);
    }
  }
  return years.length;
}

export const writeSeasons = internalMutation({
  args: { franchiseId: v.id("franchises"), standings: v.array(vImportedStanding) },
  returns: v.number(),
  handler: (ctx, { franchiseId, standings }) => writeSeasonRows(ctx, franchiseId, standings),
});

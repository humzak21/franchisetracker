/**
 * The user team's seasons as History shows them (FEATURES.md 5.7): seasons before the franchise
 * typed in, read from a screenshot or a CSV, or corrected by hand, and the finish of a franchise
 * season (its record comes from its games).
 */
import { v } from "convex/values";
import { seasonRecordError, type SeasonRecordInput } from "../../shared/history/seasonRecord";
import type { Doc } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vPlayoffResult } from "../lib/validators";
import { seasonForYear } from "./importSeasons";

/** The NFL's first season. */
const FIRST_YEAR = 1920;

export type HistorySeason = {
  year: number;
  record: SeasonRecordInput;
  headCoach?: string;
  notes?: string;
  pointsFor?: number;
  pointsAgainst?: number;
};

const trimmed = (text: string | undefined) => (text?.trim() ? text.trim() : undefined);

/** The staff with the head coach set, or removed when the name is empty. */
function withCoach(coaching: Doc<"seasons">["coaching"], name: string | undefined) {
  const { headCoach: _old, ...rest } = coaching ?? {};
  const headCoach = trimmed(name);
  return headCoach ? { ...rest, headCoach } : rest;
}

/** The record with only the parts that are known, so a cleared finish is removed. */
const recordOf = ({ w, l, t, divisionRank, seed, playoffResult }: SeasonRecordInput): SeasonRecordInput => ({
  w,
  l,
  t,
  ...(divisionRank !== undefined ? { divisionRank } : {}),
  ...(seed !== undefined ? { seed } : {}),
  ...(playoffResult !== undefined ? { playoffResult } : {}),
});

/**
 * Writes one season before the franchise: the season row (added if the year is new) with the
 * record, coach and note, and the team's standings row with the points. A coach, note or points
 * left out keeps what was there; an empty coach or note clears it. Franchise seasons are refused; their records come from their games.
 */
export async function writeHistorySeason(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  season: HistorySeason,
): Promise<void> {
  const { year, record } = season;
  if (!Number.isInteger(year) || year < FIRST_YEAR) throw invalid(`Seasons start in ${FIRST_YEAR}`);
  if (year >= franchise.startYear) {
    throw invalid(`${year} is a franchise season; its record comes from its games`);
  }
  const error = seasonRecordError(record);
  if (error) throw invalid(`${year}: ${error}`);
  const existing = await seasonForYear(ctx, franchise._id, year);
  const seasonId =
    existing?._id ??
    (await ctx.db.insert("seasons", { franchiseId: franchise._id, year, status: "complete" }));
  await ctx.db.patch("seasons", seasonId, {
    status: "complete",
    userRecord: recordOf(record),
    ...(season.headCoach !== undefined ? { coaching: withCoach(existing?.coaching, season.headCoach) } : {}),
    ...(season.notes !== undefined ? { notes: trimmed(season.notes) } : {}),
  });

  const teamId = franchise.userTeamId;
  const standing = await ctx.db
    .query("standings")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
    .unique();
  const fields = {
    ...recordOf(record),
    ...(season.pointsFor !== undefined ? { pointsFor: season.pointsFor } : {}),
    ...(season.pointsAgainst !== undefined ? { pointsAgainst: season.pointsAgainst } : {}),
    source: "import" as const,
  };
  if (standing) await ctx.db.patch("standings", standing._id, fields);
  else await ctx.db.insert("standings", { franchiseId: franchise._id, seasonId, teamId, ...fields });
}

/**
 * Corrects a saved season from History. A season before the franchise takes everything; a
 * franchise season keeps the record its games give and takes its finish, coach and note.
 */
export const update = mutation({
  args: {
    seasonId: v.id("seasons"),
    w: v.number(),
    l: v.number(),
    t: v.number(),
    divisionRank: v.optional(v.number()),
    seed: v.optional(v.number()),
    playoffResult: v.optional(vPlayoffResult),
    headCoach: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { seasonId, headCoach, notes, ...record }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = must(await ctx.db.get("seasons", seasonId), "Season");
    if (season.franchiseId !== franchise._id) throw invalid("That season belongs to another franchise");
    if (season.year < franchise.startYear) {
      await writeHistorySeason(ctx, franchise, { year: season.year, record, headCoach, notes });
      return null;
    }
    const games = season.userRecord ?? { w: 0, l: 0, t: 0 };
    if (games.w !== record.w || games.l !== record.l || games.t !== record.t) {
      throw invalid(`The ${season.year} record comes from its games; edit those on the Schedule`);
    }
    const error = record.w + record.l + record.t > 0 ? seasonRecordError(record) : null;
    if (error) throw invalid(error);
    await ctx.db.patch("seasons", seasonId, {
      userRecord: recordOf(record),
      coaching: withCoach(season.coaching, headCoach),
      notes: trimmed(notes),
    });
    return null;
  },
});

/** Franchise creation, shared by the setup mutation and the sample-data fixture. */
import { FIRST_SEASON_RANGE } from "../../shared/domain";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { appError, invalid, must } from "../lib/errors";

const DEFAULT_SETTINGS = { gamesPerSeason: 17, playoffTeams: 14 };
const MAX_NAME_LENGTH = 60;

export type NewFranchise = { name: string; teamAbbr: string; startYear: number };

/**
 * Creates the active franchise and its first season. One active franchise at a time for now
 * (the model supports several; creating and switching franchises is Sprint 8), so a second create
 * is refused.
 */
export async function createFranchise(
  ctx: MutationCtx,
  { name, teamAbbr, startYear }: NewFranchise,
): Promise<{ franchiseId: Id<"franchises">; seasonId: Id<"seasons"> }> {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    throw invalid(`Name the franchise (up to ${MAX_NAME_LENGTH} characters)`);
  }
  if (
    !Number.isInteger(startYear) ||
    startYear < FIRST_SEASON_RANGE.min ||
    startYear > FIRST_SEASON_RANGE.max
  ) {
    throw invalid(`First season must be between ${FIRST_SEASON_RANGE.min} and ${FIRST_SEASON_RANGE.max}`);
  }
  const existing = await ctx.db
    .query("franchises")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .first();
  if (existing !== null) throw appError("conflict", "A franchise already exists");

  const team = must(
    await ctx.db
      .query("teams")
      .withIndex("by_abbr", (q) => q.eq("abbr", teamAbbr))
      .unique(),
    `Team ${teamAbbr}`,
  );
  const franchiseId = await ctx.db.insert("franchises", {
    name: trimmed,
    userTeamId: team._id,
    startYear,
    settings: DEFAULT_SETTINGS,
    isActive: true,
  });
  const seasonId = await ctx.db.insert("seasons", { franchiseId, year: startYear, status: "upcoming" });
  return { franchiseId, seasonId };
}

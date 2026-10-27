/** Franchise creation, shared by the setup mutation and the sample-data fixture. */
import { FIRST_SEASON_RANGE } from "../../shared/domain";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";

const DEFAULT_SETTINGS = { gamesPerSeason: 17, playoffTeams: 14 };
const MAX_NAME_LENGTH = 60;

export type NewFranchise = { name: string; teamAbbr: string; startYear: number };

/**
 * Creates a franchise and its first season and makes it the active one. Exactly one franchise is
 * active at a time; the others keep their data untouched until switched back to.
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
  const team = must(
    await ctx.db
      .query("teams")
      .withIndex("by_abbr", (q) => q.eq("abbr", teamAbbr))
      .unique(),
    `Team ${teamAbbr}`,
  );
  await deactivateAll(ctx);
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

/** At most a handful of franchises are ever active at once (one, unless something went wrong). */
const MAX_ACTIVE = 10;

/** Clears the active flag everywhere, so the caller can set exactly one, noting when each was left. */
export async function deactivateAll(ctx: MutationCtx): Promise<void> {
  const active = await ctx.db
    .query("franchises")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .take(MAX_ACTIVE);
  const now = Date.now();
  for (const franchise of active) {
    await ctx.db.patch("franchises", franchise._id, { isActive: false, lastActiveAt: now });
  }
}

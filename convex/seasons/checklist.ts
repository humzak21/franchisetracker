/**
 * The season checklist on Home (FEATURES.md 5.1): each item is read from the data the matching
 * screen or step writes, so it shows what is done without anything to tick.
 */
import { v } from "convex/values";
import { nextWeek, lastPlayedWeek } from "../../shared/games/summary";
import { currentGroup, seasonChecklist, CHECKLIST_GROUPS } from "../../shared/seasons/checklist";
import { coverageItems } from "../../shared/seasons/coverage";
import { STAT_REGISTRY, type StatCategory, type StatKey } from "../../shared/stats/registry";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { vTargetKey } from "../lib/draftValidators";
import { activeFranchise, MAX_ROSTER } from "../lib/franchise";
import { literals } from "../lib/validators";
import { latestSync } from "../players/rosterSync";
import { retirementSuggestions } from "../players/retirements";
import { capturedGames, awardWeeks, coverageFacts, standingsGames, vCoverage } from "./coverage";

/** One team's season stat rows from a season stats screen. */
const MAX_REPORTED = 300;
/** A year's transactions of one kind, with headroom. */
const MAX_SIGNINGS = 200;
/** Picks one draft holds. */
const MAX_PICKS = 300;
/** A season's goals. */
const MAX_GOALS = 50;

const vAction = v.union(
  v.object({ kind: v.literal("capture"), target: vTargetKey }),
  v.object({ kind: v.literal("open"), place: literals(["roster", "transactions", "goals", "report"]) }),
  v.object({ kind: v.literal("retirements") }),
);

const vChecklist = v.object({
  current: literals(CHECKLIST_GROUPS),
  groups: v.array(
    v.object({
      key: literals(CHECKLIST_GROUPS),
      items: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          detail: v.optional(v.string()),
          done: v.boolean(),
          optional: v.optional(v.boolean()),
          action: vAction,
        }),
      ),
    }),
  ),
  coverage: vCoverage,
});

/** Stat categories a season stats screen covered, from the keys of the rows it left. */
async function reportedCategories(ctx: QueryCtx, seasonId: Id<"seasons">, teamId: Id<"teams">) {
  const rows = await ctx.db
    .query("reportedSeasonStats")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
    .take(MAX_REPORTED);
  const categories = new Set<StatCategory>();
  for (const row of rows) {
    for (const key of Object.keys(row.stats)) {
      const def = STAT_REGISTRY[key as StatKey];
      if (def) categories.add(def.category);
    }
  }
  return [...categories];
}

async function checklistFor(ctx: QueryCtx, franchise: Doc<"franchises">, season: Doc<"seasons">) {
  const seasonId = season._id;
  const teamId = franchise.userTeamId;
  const [
    entries,
    captured,
    standings,
    awards,
    sync,
    signings,
    picks,
    goals,
    report,
    categories,
    teamStat,
    retirements,
  ] = await Promise.all([
    ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
      .take(MAX_ROSTER),
    capturedGames(ctx, seasonId),
    standingsGames(ctx, season, teamId),
    awardWeeks(ctx, seasonId),
    latestSync(ctx, seasonId, teamId),
    ctx.db
      .query("transactions")
      .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", seasonId).eq("type", "sign"))
      .take(MAX_SIGNINGS),
    ctx.db
      .query("draftPicks")
      .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", seasonId))
      .take(MAX_PICKS),
    ctx.db
      .query("seasonGoals")
      .withIndex("by_seasonId_and_order", (q) => q.eq("seasonId", seasonId))
      .take(MAX_GOALS),
    ctx.db
      .query("seasonReports")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
      .first(),
    reportedCategories(ctx, seasonId, teamId),
    ctx.db
      .query("teamSeasonStats")
      .withIndex("by_seasonId_and_teamId_and_statKey", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
      .first(),
    season.retirementsReviewed ? [] : retirementSuggestions(ctx, franchise, season),
  ]);
  const games = captured.map((c) => c.game);
  const week = lastPlayedWeek(games) ?? nextWeek(games);
  const facts = coverageFacts(captured, standings, awards.weeks);
  const groups = seasonChecklist({
    status: season.status,
    firstSeason: season.year === franchise.startYear,
    carried: entries.length > 0,
    retirementsWaiting: retirements.length,
    unsigned: entries.filter((e) => e.status === "unsigned").length,
    signings: signings.filter((s) => s.teamId === teamId).length,
    draftPicks: picks.filter((p) => p.teamId === teamId).length,
    rosterPage: sync !== null,
    depthChart: entries.some((e) => e.depthSlot !== undefined),
    goals: goals.length,
    prompts: report?.prompts ?? null,
    week,
    weekHasBoxScore: captured.some((c) => c.game.weekKey === week && c.boxScore),
    weekHasAwards: awards.weeks.includes(week),
    regularGames: facts.regularGames,
    standingsGames: standings,
    seasonStats: categories,
    teamStats: teamStat !== null,
    yearlyAwards: awards.yearly,
    playoffsSettled: season.userRecord?.playoffResult !== undefined,
  });
  return { current: currentGroup(season.status, groups), groups, coverage: coverageItems(facts) };
}

/** Null for imported NFL seasons and anything outside the active franchise. */
export const forSeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.union(v.null(), vChecklist),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id || season.year < franchise.startYear) return null;
    return await checklistFor(ctx, franchise, season);
  },
});

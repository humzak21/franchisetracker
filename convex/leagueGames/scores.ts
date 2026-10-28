/** League scores: every game in a week across the league, from the schedule screen or typed in. */
import { v } from "convex/values";
import { WEEK_KEYS, weekIndex, type WeekKey } from "../../shared/domain";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must, notFound } from "../lib/errors";
import { activeFranchise, teamsById } from "../lib/franchise";
import { vWeekKey } from "../lib/validators";

/** Sixteen games a week with headroom. */
const MAX_WEEK_GAMES = 40;
/** Every game of a season: 18 weeks of 16 games plus the playoffs. */
const MAX_SEASON_GAMES = 400;

const vTeam = v.object({
  abbr: v.string(),
  city: v.string(),
  name: v.string(),
  primaryColor: v.string(),
  secondaryColor: v.string(),
});

const vScoreGame = v.object({
  _id: v.id("leagueGames"),
  away: vTeam,
  home: vTeam,
  awayScore: v.union(v.number(), v.null()),
  homeScore: v.union(v.number(), v.null()),
  timeLabel: v.union(v.string(), v.null()),
  /** The user's team plays in it. */
  isUser: v.boolean(),
});

/** One week's games, the user's first, then in the order they were stored. */
export const byWeek = query({
  args: { seasonId: v.id("seasons"), weekKey: vWeekKey },
  returns: v.array(vScoreGame),
  handler: async (ctx, { seasonId, weekKey }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) throw notFound("Season");
    const [games, teams] = await Promise.all([
      ctx.db
        .query("leagueGames")
        .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId).eq("weekKey", weekKey))
        .take(MAX_WEEK_GAMES),
      teamsById(ctx),
    ]);
    const view = (id: (typeof games)[number]["awayTeamId"]) => {
      const { abbr, city, name, primaryColor, secondaryColor } = must(teams.get(id), "Team");
      return { abbr, city, name, primaryColor, secondaryColor };
    };
    const rows = games.map((g) => ({
      _id: g._id,
      away: view(g.awayTeamId),
      home: view(g.homeTeamId),
      awayScore: g.awayScore ?? null,
      homeScore: g.homeScore ?? null,
      timeLabel: g.timeLabel ?? null,
      isUser: g.awayTeamId === franchise.userTeamId || g.homeTeamId === franchise.userTeamId,
    }));
    return [...rows.filter((r) => r.isUser), ...rows.filter((r) => !r.isUser)];
  },
});

/**
 * The weeks of a season that have league games, in calendar order, for the week picker, and the
 * week to open on: the latest with a score, else the first (a schedule loaded before kickoff).
 */
export const weeks = query({
  args: { seasonId: v.id("seasons") },
  returns: v.object({ weeks: v.array(vWeekKey), current: v.union(vWeekKey, v.null()) }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) throw notFound("Season");
    const games = await ctx.db
      .query("leagueGames")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_SEASON_GAMES);
    const present = new Set<WeekKey>(games.map((g) => g.weekKey));
    const scored = new Set<WeekKey>(games.filter((g) => g.homeScore !== undefined).map((g) => g.weekKey));
    const ordered = WEEK_KEYS.filter((w) => present.has(w)).sort((a, b) => weekIndex(a) - weekIndex(b));
    return { weeks: ordered, current: ordered.findLast((w) => scored.has(w)) ?? ordered[0] ?? null };
  },
});

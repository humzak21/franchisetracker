/**
 * The week on Home (FEATURES.md 5.1): the latest result with its stars, what it set and how it
 * moved the team, shown as a card and copied as text (`shared/games/digest.ts`).
 */
import { v } from "convex/values";
import { RECORD_MILESTONES } from "../../shared/domain";
import { sortByWeek, seasonSummary, userScore } from "../../shared/games/summary";
import { alignmentFor, leagueAlignment } from "../../shared/league/alignment";
import { divisionMove } from "../../shared/league/divisionMove";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { vWlt } from "../games/validators";
import { gameRow, loadStarPlayers } from "../games/views";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { seasonGames } from "../lib/reports";
import { seasonScores } from "../lib/seasonScores";
import { vGameResult, vWeekKey } from "../lib/validators";

/** Everything one game can raise: a handful of players, several stats each. */
const MAX_MILESTONES = 60;
/** A big game raises a dozen of these; the card keeps to the headlines, the feed has the rest. */
const MILESTONES_SHOWN = 6;

const vDigest = v.object({
  gameId: v.id("games"),
  teamName: v.string(),
  opponentName: v.string(),
  weekKey: vWeekKey,
  result: vGameResult,
  us: v.number(),
  them: v.number(),
  home: v.boolean(),
  overtime: v.boolean(),
  record: vWlt,
  streak: v.union(v.string(), v.null()),
  stars: v.array(
    v.object({
      playerId: v.union(v.id("players"), v.null()),
      name: v.string(),
      statLine: v.union(v.string(), v.null()),
    }),
  ),
  records: v.array(v.string()),
  milestones: v.array(v.string()),
  division: v.string(),
  standing: v.union(v.object({ rank: v.number(), previous: v.number() }), v.null()),
});

async function standingMove(
  ctx: QueryCtx,
  year: number,
  seasonId: Id<"seasons">,
  team: Doc<"teams">,
  game: Doc<"games">,
  teams: Map<Id<"teams">, Doc<"teams">>,
) {
  const own = alignmentFor(year, team);
  const members = [...leagueAlignment(year)]
    .filter(([, a]) => a.conference === own.conference && a.division === own.division)
    .map(([teamAbbr, a]) => ({ teamAbbr, ...a }));
  const { regular } = await seasonScores(ctx, seasonId, teams);
  return {
    division: `${own.conference} ${own.division}`,
    standing: divisionMove(team.abbr, members, regular, game.weekKey),
  };
}

export async function latestDigest(ctx: QueryCtx, franchise: Doc<"franchises">, season: Doc<"seasons">) {
  const seasonId = season._id;
  const games = sortByWeek(await seasonGames(ctx, seasonId));
  const game = games.findLast((g) => userScore(g) !== null);
  const score = game && userScore(game);
  if (!game || !score || !game.opponentTeamId || !game.result) return null;

  const teams = await teamsById(ctx);
  const own = teams.get(franchise.userTeamId);
  const opponent = teams.get(game.opponentTeamId);
  if (!own || !opponent) return null;
  const [stars, milestones, place] = await Promise.all([
    loadStarPlayers(ctx, [game]),
    ctx.db
      .query("milestones")
      .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
      .take(MAX_MILESTONES),
    standingMove(ctx, season.year, seasonId, own, game, teams),
  ]);
  const summary = seasonSummary(games);
  return {
    gameId: game._id,
    teamName: own.name,
    opponentName: opponent.name,
    weekKey: game.weekKey,
    result: game.result,
    us: score.us,
    them: score.them,
    home: game.userIsHome ?? true,
    overtime: game.overtime ?? false,
    record: summary.regular,
    streak: summary.streak,
    stars: gameRow(game, teams, stars)
      .stars.filter((s) => s.teamId === own._id || (s.teamId === null && s.playerId !== null))
      .map(({ playerId, name, statLine }) => ({ playerId, name, statLine })),
    records: milestones.filter((m) => RECORD_MILESTONES.includes(m.kind)).map((m) => m.title),
    milestones: milestones
      .filter((m) => !RECORD_MILESTONES.includes(m.kind))
      .slice(0, MILESTONES_SHOWN)
      .map((m) => m.title),
    ...place,
  };
}

export const latest = query({
  args: { seasonId: v.id("seasons") },
  returns: v.union(vDigest, v.null()),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) return null;
    return latestDigest(ctx, franchise, season);
  },
});

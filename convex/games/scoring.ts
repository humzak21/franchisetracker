/**
 * A game's scoring plays on its page: the summary and how the game went, who can be put on a
 * play, and assigning one. The plays themselves are written by `ingestion/commitScoringPlays`.
 */
import { v } from "convex/values";
import { gameFlow } from "../../shared/stats/scoring";
import { nameTokens } from "../../shared/ingestion/nameMatch";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, playersById } from "../lib/franchise";
import { rowGameContext, vRowGameContext } from "../lib/gameContext";
import { headshotUrls } from "../lib/refs";
import { literals, vPatResult, vPosition, vScoringKind } from "../lib/validators";
import { rememberPlayer } from "../ingestion/playerAssignments";
import { ownGame } from "./access";
import { gamePlays } from "./playRows";

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());

/** A 53-man roster plus practice squad and injured reserve, with room for in-season moves. */
const MAX_ROSTER = 150;

/** The game a game-scoped list would file under, for review's checks; null when there is none. */
export const reviewContext = query({
  args: { gameId: nullable(v.id("games")) },
  returns: nullable(vRowGameContext),
  handler: async (ctx, { gameId }) => {
    await requireOwner(ctx);
    if (gameId) await ownGame(ctx, gameId);
    return await rowGameContext(ctx, gameId);
  },
});

const vPlayView = v.object({
  _id: v.id("scoringPlays"),
  period: v.number(),
  clock: v.number(),
  teamId: v.id("teams"),
  kind: vScoringKind,
  yards: nullable(v.number()),
  playerId: nullable(v.id("players")),
  /** The player's name, or the name as printed until one is assigned. */
  scorer: nullable(v.string()),
  passerId: nullable(v.id("players")),
  passer: nullable(v.string()),
  pat: nullable(vPatResult),
  homeScore: v.number(),
  awayScore: v.number(),
  description: nullable(v.string()),
});

async function playViews(ctx: QueryCtx, plays: readonly Doc<"scoringPlays">[]) {
  const players = await playersById(
    ctx,
    plays.flatMap((p) => [p.playerId, p.passerId].filter((id): id is Id<"players"> => id !== undefined)),
  );
  const nameOf = (id: Id<"players"> | undefined) => (id ? players.get(id)?.displayName : undefined);
  return plays.map((p) => ({
    _id: p._id,
    period: p.period,
    clock: p.clock,
    teamId: p.teamId,
    kind: p.kind,
    yards: p.yards ?? null,
    playerId: p.playerId ?? null,
    scorer: nameOf(p.playerId) ?? p.rawName ?? null,
    passerId: p.passerId ?? null,
    passer: nameOf(p.passerId) ?? p.passerName ?? null,
    pat: p.pat ?? null,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    description: p.description ?? null,
  }));
}

/** The plays in order, how the game went, and the box score for assigning a missing name. */
export const byGame = query({
  args: { gameId: v.id("games") },
  returns: v.object({
    plays: v.array(vPlayView),
    gameWinnerId: nullable(v.id("scoringPlays")),
    leadChanges: v.number(),
    ties: v.number(),
    /** The most the winner trailed by. */
    deficitOvercome: v.number(),
    context: nullable(vRowGameContext),
  }),
  handler: async (ctx, { gameId }) => {
    await requireOwner(ctx);
    const game = await ctx.db.get("games", gameId);
    const plays = game ? await gamePlays(ctx, gameId) : [];
    const flow = gameFlow(plays);
    return {
      plays: await playViews(ctx, plays),
      gameWinnerId: flow.gameWinner?._id ?? null,
      leadChanges: flow.leadChanges,
      ties: flow.ties,
      deficitOvercome: flow.deficitOvercome,
      context: game ? await rowGameContext(ctx, gameId) : null,
    };
  },
});

/** Who can be put on a play: one team's players in this game, then the rest of its roster. */
export const candidates = query({
  args: { gameId: v.id("games"), teamId: v.id("teams") },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      name: v.string(),
      position: vPosition,
      headshotUrl: nullable(v.string()),
      inGame: v.boolean(),
    }),
  ),
  handler: async (ctx, { gameId, teamId }) => {
    await requireOwner(ctx);
    const { game } = await ownGame(ctx, gameId);
    const context = await rowGameContext(ctx, gameId);
    const team = must(await ctx.db.get("teams", teamId), "Team");
    const inGame = new Set(context?.lines.filter((l) => l.teamAbbr === team.abbr).map((l) => l.playerId));
    const roster = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", game.seasonId).eq("teamId", teamId))
      .take(MAX_ROSTER);
    const players = await playersById(ctx, [...inGame, ...roster.map((e) => e.playerId)]);
    const headshots = await headshotUrls(ctx, players.values());
    return [...players.values()]
      .map((p) => ({
        playerId: p._id,
        name: p.displayName,
        position: p.position,
        headshotUrl: headshots.get(p._id) ?? null,
        inGame: inGame.has(p._id),
      }))
      .sort((a, b) => Number(b.inGame) - Number(a.inGame) || a.name.localeCompare(b.name));
  },
});

/** Puts a player on a play, as its scorer or its passer, and remembers how the screen printed the name. */
export const assign = mutation({
  args: {
    playId: v.id("scoringPlays"),
    role: literals(["scorer", "passer"]),
    playerId: v.id("players"),
  },
  returns: v.null(),
  handler: async (ctx, { playId, role, playerId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const play = must(await ctx.db.get("scoringPlays", playId), "Scoring play");
    if (play.franchiseId !== franchise._id) throw invalid("That play belongs to another franchise");
    const player = must(await ctx.db.get("players", playerId), "Player");
    if (player.franchiseId !== franchise._id) throw invalid("That player belongs to another franchise");
    await ctx.db.patch("scoringPlays", playId, role === "scorer" ? { playerId } : { passerId: playerId });
    const printed = role === "scorer" ? play.rawName : play.passerName;
    const team = await ctx.db.get("teams", play.teamId);
    if (printed && team && nameTokens(printed).length > 0) {
      await rememberPlayer(ctx, {
        franchiseId: franchise._id,
        seasonId: play.seasonId,
        teamAbbr: team.abbr,
        name: printed,
        playerId,
      });
    }
    await ctx.scheduler.runAfter(0, internal.stats.scoring.afterPlays, { gameId: play.gameId });
    return null;
  },
});

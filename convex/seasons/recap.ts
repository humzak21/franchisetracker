/**
 * A season's recap (FEATURES.md 5.7): the year told from what was captured, generated on read so
 * it stays right as a late screen or a correction lands. Nothing here is stored.
 */
import { v } from "convex/values";
import { RECORD_MILESTONES, weekIndex, weekPhase, type WeekKey } from "../../shared/domain";
import { meetingHighs } from "../../shared/games/rivalry";
import { resultOf, seasonSummary, sortByWeek, userScore } from "../../shared/games/summary";
import { alignmentFor } from "../../shared/league/alignment";
import { recapAwards, recapHeadline, recapMoves } from "../../shared/seasons/recap";
import { LEADER_STATS, pickLabel, teamLeaders, transactionLabel } from "../../shared/seasons/summary";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { vSeasonSummary, vWeekPoint } from "../games/validators";
import { weekPointRows } from "../games/views";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { reportFor, seasonByYear, seasonGames } from "../lib/reports";
import { literals, vGameResult, vPosition, vWeekKey } from "../lib/validators";
import schema from "../schema";

/** A full roster plus the players who came and went. */
const MAX_SEASON_ROWS = 150;
/** Every award in the league in a year, weekly ones included. */
const MAX_AWARDS = 600;
const MAX_MOVES = 300;
const MAX_MILESTONES = 400;
/** A seven-round draft, compensatory picks included. */
const MAX_PICKS = 300;

const vPlayerRef = v.object({
  _id: v.id("players"),
  displayName: v.string(),
  position: vPosition,
  headshotUrl: v.union(v.string(), v.null()),
});
const vHighGame = v.union(
  v.object({
    gameId: v.id("games"),
    year: v.number(),
    weekKey: vWeekKey,
    us: v.number(),
    them: v.number(),
    result: vGameResult,
    opponentAbbr: v.union(v.string(), v.null()),
  }),
  v.null(),
);

const weekOrder = (weekKey: WeekKey | undefined) => (weekKey ? weekIndex(weekKey) : -1);

export async function seasonRecap(ctx: QueryCtx, franchise: Doc<"franchises">, year: number) {
  const season = await seasonByYear(ctx, franchise._id, year);
  if (!season || year < franchise.startYear) return null;
  const seasonId = season._id;
  const userTeamId = franchise.userTeamId;
  const [report, rawGames, rows, awards, milestones, moves, picks, standing, teams] = await Promise.all([
    reportFor(ctx, seasonId),
    seasonGames(ctx, seasonId),
    ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", userTeamId))
      .take(MAX_SEASON_ROWS),
    ctx.db
      .query("awards")
      .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", seasonId))
      .take(MAX_AWARDS),
    ctx.db
      .query("milestones")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_MILESTONES),
    ctx.db
      .query("transactions")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_MOVES),
    ctx.db
      .query("draftPicks")
      .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", seasonId))
      .take(MAX_PICKS),
    ctx.db
      .query("standings")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", userTeamId))
      .unique(),
    teamsById(ctx),
  ]);

  const games = sortByWeek(rawGames);
  const summary = seasonSummary(games);
  const played = games.flatMap((g) => {
    const score = userScore(g);
    const result = resultOf(g);
    const opponent = g.opponentTeamId ? teams.get(g.opponentTeamId) : undefined;
    if (!score || !result || weekPhase(g.weekKey) === "preseason") return [];
    return [
      {
        gameId: g._id,
        year,
        weekKey: g.weekKey,
        ...score,
        result,
        opponentAbbr: opponent?.abbr ?? null,
      },
    ];
  });
  const { bestWin, worstLoss, longestWin, longestLoss } = meetingHighs(played);
  const leaders = teamLeaders(rows.filter((r) => r.split === "regular"));
  const ownAwards = awards.filter((a) => a.teamId === userTeamId);
  const ownMoves = moves.filter((m) => m.teamId === undefined || m.teamId === userTeamId);
  const told = recapMoves(ownMoves);
  const ownPicks = picks.filter((p) => p.teamId === userTeamId);
  const refs = (m: (typeof told.shown)[number]) => [...m.playersIn, ...m.playersOut];
  const players = await playersById(ctx, [
    ...leaders.map((l) => l.playerId),
    ...ownAwards.flatMap((a) => (a.playerId ? [a.playerId] : [])),
    ...told.shown.flatMap((m) => refs(m).flatMap((p) => (p.playerId ? [p.playerId] : []))),
    ...ownPicks.flatMap((p) => (p.playerId ? [p.playerId] : [])),
  ]);
  const photos = await headshotUrls(
    ctx,
    leaders.flatMap((l) => players.get(l.playerId) ?? []),
  );
  const name = (ref: { playerId?: Id<"players">; rawName?: string }) =>
    (ref.playerId && players.get(ref.playerId)?.displayName) || ref.rawName || "";
  const own = teams.get(userTeamId);
  const alignment = own ? alignmentFor(year, own) : null;
  const text = (s: string | undefined) => (s?.trim() ? s.trim() : undefined);

  return {
    season,
    headline: recapHeadline({
      regular: summary.regular,
      divisionRank: standing?.divisionRank ?? season.userRecord?.divisionRank ?? null,
      division: alignment ? `${alignment.conference} ${alignment.division}` : "division",
      seed: standing?.seed ?? season.userRecord?.seed ?? null,
      playoffResult: season.userRecord?.playoffResult ?? null,
    }),
    summary,
    weeks: weekPointRows(games, teams),
    highs: { bestWin, worstLoss, longestWin, longestLoss },
    leaders: leaders.flatMap((l) => {
      const p = players.get(l.playerId);
      return p
        ? [
            {
              stat: l.stat,
              value: l.value,
              player: {
                _id: p._id,
                displayName: p.displayName,
                position: p.position,
                headshotUrl: photos.get(p._id) ?? null,
              },
            },
          ]
        : [];
    }),
    awards: recapAwards(
      ownAwards.map((a) => ({
        type: a.type,
        customName: a.customName,
        weekKey: a.weekKey,
        playerId: a.playerId,
        name: name(a),
      })),
    ),
    records: milestones
      .filter((m) => RECORD_MILESTONES.includes(m.kind))
      .sort((a, b) => weekOrder(a.weekKey) - weekOrder(b.weekKey))
      .map((m) => ({
        _id: m._id,
        title: m.title,
        weekKey: m.weekKey ?? null,
        playerId: m.playerId ?? null,
        gameId: m.gameId ?? null,
      })),
    moves: {
      rows: told.shown.map((m) => ({
        _id: m._id,
        label: transactionLabel(m.type, m.weekKey, refs(m).map(name).filter(Boolean)),
        playerId: refs(m)[0]?.playerId,
      })),
      total: told.total,
    },
    draft: ownPicks.map((p) => ({
      _id: p._id,
      label: pickLabel(p.round, p.overall, name(p) || undefined),
      position: p.position,
      playerId: p.playerId,
    })),
    words: {
      preseason: text(report?.preseasonThoughts),
      postseason: text(report?.postseasonThoughts),
      aroundTheLeague: text(report?.aroundTheLeague),
    },
  };
}

export const get = query({
  args: { year: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      season: schema.doc("seasons"),
      headline: v.string(),
      summary: vSeasonSummary,
      weeks: v.array(vWeekPoint),
      highs: v.object({
        bestWin: vHighGame,
        worstLoss: vHighGame,
        longestWin: v.number(),
        longestLoss: v.number(),
      }),
      leaders: v.array(v.object({ stat: literals(LEADER_STATS), value: v.number(), player: vPlayerRef })),
      awards: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          name: v.string(),
          playerId: v.optional(v.id("players")),
          count: v.number(),
        }),
      ),
      records: v.array(
        v.object({
          _id: v.id("milestones"),
          title: v.string(),
          weekKey: v.union(vWeekKey, v.null()),
          playerId: v.union(v.id("players"), v.null()),
          gameId: v.union(v.id("games"), v.null()),
        }),
      ),
      moves: v.object({
        rows: v.array(
          v.object({ _id: v.id("transactions"), label: v.string(), playerId: v.optional(v.id("players")) }),
        ),
        total: v.number(),
      }),
      draft: v.array(
        v.object({
          _id: v.id("draftPicks"),
          label: v.string(),
          position: v.optional(vPosition),
          playerId: v.optional(v.id("players")),
        }),
      ),
      words: v.object({
        preseason: v.optional(v.string()),
        postseason: v.optional(v.string()),
        aroundTheLeague: v.optional(v.string()),
      }),
    }),
  ),
  handler: async (ctx, { year }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    return seasonRecap(ctx, franchise, year);
  },
});

/**
 * Any team's history inside the franchise (FEATURES.md 5.6): record and playoff result by season,
 * the all-time line, head-to-head against the user team, the players we have seen on their
 * rosters and their draft picks.
 */
import { v } from "convex/values";
import { weekIndex } from "../../shared/domain";
import { leagueTable } from "../../shared/league/standings";
import { resultOf, userScore } from "../../shared/games/summary";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, playersById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { franchiseSeasonList } from "../lib/reports";
import { vGameResult, vPlayoffResult, vPosition, vWeekKey } from "../lib/validators";

const MAX_SEASONS = 150;
const MAX_GAMES = 300;
const MAX_PICKS = 400;
const MAX_ROSTER = 150;
/** Recent franchise seasons whose observed rosters are listed. */
const ROSTER_SEASONS = 3;

export const get = query({
  args: { teamAbbr: v.string() },
  returns: v.object({
    team: vTeamRef,
    conference: v.string(),
    division: v.string(),
    isUserTeam: v.boolean(),
    startYear: v.number(),
    seasons: v.array(
      v.object({
        year: v.number(),
        w: v.number(),
        l: v.number(),
        t: v.number(),
        divisionRank: v.optional(v.number()),
        seed: v.optional(v.number()),
        playoffResult: v.optional(vPlayoffResult),
      }),
    ),
    totals: v.object({
      playoffs: v.number(),
      playoffW: v.number(),
      playoffL: v.number(),
      divisionTitles: v.number(),
      conferenceTitles: v.number(),
      superBowls: v.number(),
      w: v.number(),
      l: v.number(),
      t: v.number(),
    }),
    headToHead: v.object({
      w: v.number(),
      l: v.number(),
      t: v.number(),
      games: v.array(
        v.object({
          gameId: v.id("games"),
          year: v.number(),
          weekKey: vWeekKey,
          us: v.number(),
          them: v.number(),
          result: vGameResult,
        }),
      ),
    }),
    players: v.array(
      v.object({
        playerId: v.id("players"),
        displayName: v.string(),
        position: vPosition,
        jersey: v.optional(v.number()),
        ovr: v.optional(v.number()),
        year: v.number(),
        partial: v.boolean(),
      }),
    ),
    draftPicks: v.array(
      v.object({
        _id: v.id("draftPicks"),
        year: v.number(),
        round: v.number(),
        overall: v.number(),
        playerId: v.optional(v.id("players")),
        name: v.string(),
        position: v.optional(vPosition),
      }),
    ),
  }),
  handler: async (ctx, { teamAbbr }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const team = must(
      await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", teamAbbr.toUpperCase()))
        .unique(),
      `Team ${teamAbbr}`,
    );
    const seasons = await franchiseSeasonList(ctx, franchise._id);
    const years = new Map<Id<"seasons">, number>(seasons.map((s) => [s._id, s.year]));
    const [standings, games, picks] = await Promise.all([
      ctx.db
        .query("standings")
        .withIndex("by_franchiseId_and_teamId", (q) =>
          q.eq("franchiseId", franchise._id).eq("teamId", team._id),
        )
        .take(MAX_SEASONS),
      ctx.db
        .query("games")
        .withIndex("by_franchiseId_and_opponentTeamId", (q) =>
          q.eq("franchiseId", franchise._id).eq("opponentTeamId", team._id),
        )
        .take(MAX_GAMES),
      ctx.db
        .query("draftPicks")
        .withIndex("by_franchiseId_and_teamId", (q) =>
          q.eq("franchiseId", franchise._id).eq("teamId", team._id),
        )
        .take(MAX_PICKS),
    ]);

    const rows = standings
      .flatMap((r) => {
        const year = years.get(r.seasonId);
        return year === undefined
          ? []
          : [
              {
                year,
                w: r.w,
                l: r.l,
                t: r.t,
                divisionRank: r.divisionRank,
                seed: r.seed,
                playoffResult: r.playoffResult,
              },
            ];
      })
      .sort((a, b) => b.year - a.year);
    const [line] = leagueTable(
      rows.map((r) => [{ ...r, teamAbbr: team.abbr, conference: team.conference, division: team.division }]),
    );

    const played = games.flatMap((g) => {
      const score = userScore(g);
      const result = resultOf(g);
      const year = years.get(g.seasonId);
      return score && result && year !== undefined
        ? [{ gameId: g._id, year, weekKey: g.weekKey, us: score.us, them: score.them, result }]
        : [];
    });
    played.sort((a, b) => b.year - a.year || weekIndex(b.weekKey) - weekIndex(a.weekKey));

    const recent = seasons
      .filter((s) => s.year >= franchise.startYear)
      .sort((a, b) => b.year - a.year)
      .slice(0, ROSTER_SEASONS);
    const entries = (
      await Promise.all(
        recent.map(async (s) =>
          (
            await ctx.db
              .query("rosterEntries")
              .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", s._id).eq("teamId", team._id))
              .take(MAX_ROSTER)
          ).map((e) => ({ ...e, year: s.year })),
        ),
      )
    ).flat();
    const latest = new Map<Id<"players">, (typeof entries)[number]>();
    for (const e of entries) if ((latest.get(e.playerId)?.year ?? -1) < e.year) latest.set(e.playerId, e);
    const players = await playersById(ctx, [
      ...latest.keys(),
      ...picks.flatMap((p) => (p.playerId ? [p.playerId] : [])),
    ]);

    return {
      team: toTeamRef(team),
      conference: team.conference,
      division: team.division,
      isUserTeam: team._id === franchise.userTeamId,
      startYear: franchise.startYear,
      seasons: rows,
      totals: {
        playoffs: line?.playoffs ?? 0,
        playoffW: line?.playoffW ?? 0,
        playoffL: line?.playoffL ?? 0,
        divisionTitles: line?.divisionTitles ?? 0,
        conferenceTitles: line?.conferenceTitles ?? 0,
        superBowls: line?.superBowls ?? 0,
        w: line?.w ?? 0,
        l: line?.l ?? 0,
        t: line?.t ?? 0,
      },
      headToHead: {
        w: played.filter((g) => g.result === "W").length,
        l: played.filter((g) => g.result === "L").length,
        t: played.filter((g) => g.result === "T").length,
        games: played,
      },
      players: [...latest.values()]
        .flatMap((e) => {
          const p = players.get(e.playerId);
          return p
            ? [
                {
                  playerId: p._id,
                  displayName: p.displayName,
                  position: e.position,
                  jersey: e.jersey,
                  ovr: e.ovr,
                  year: e.year,
                  partial: e.partial === true,
                },
              ]
            : [];
        })
        .sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || a.displayName.localeCompare(b.displayName)),
      draftPicks: picks
        .flatMap((p) => {
          const year = years.get(p.seasonId);
          const player = p.playerId ? players.get(p.playerId) : undefined;
          return year === undefined
            ? []
            : [
                {
                  _id: p._id,
                  year,
                  round: p.round,
                  overall: p.overall,
                  playerId: p.playerId,
                  name: player?.displayName ?? p.rawName ?? "Unknown",
                  position: p.position,
                },
              ];
        })
        .sort((a, b) => b.year - a.year || a.overall - b.overall),
    };
  },
});

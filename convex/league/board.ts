/**
 * The League page's season board (FEATURES.md 5.6): standings with division ranks, projected or
 * final seeds and clinch marks, plus the playoff bracket, projected until the regular season is
 * over and the real one after. Every team of the season's league is listed, 0-0 before kickoff.
 */
import { v } from "convex/values";
import { PLAYOFF_ROUNDS } from "../../shared/domain";
import { alignmentFor, leagueAlignment, STANDING_DIVISIONS } from "../../shared/league/alignment";
import { seasonBoard } from "../../shared/league/projection";
import type { StandingRow } from "../../shared/league/standings";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { seasonScores } from "../lib/seasonScores";
import { literals, vConference, vPlayoffResult } from "../lib/validators";
import { seasonStandings } from "./standings";

const vClinch = v.union(v.literal("z"), v.literal("y"), v.literal("x"), v.null());
const vSide = v.object({ abbr: v.string(), seed: v.number() });

export const season = query({
  args: { seasonId: v.id("seasons") },
  returns: v.union(
    v.null(),
    v.object({
      year: v.number(),
      /** The regular season is over and the bracket is the real one. */
      final: v.boolean(),
      byeSeeds: v.number(),
      rows: v.array(
        v.object({
          team: vTeamRef,
          conference: vConference,
          division: literals(STANDING_DIVISIONS),
          w: v.number(),
          l: v.number(),
          t: v.number(),
          divisionRank: v.number(),
          conferenceRank: v.number(),
          seed: v.union(v.number(), v.null()),
          clinch: vClinch,
          playoffResult: v.optional(vPlayoffResult),
        }),
      ),
      bracket: v.array(
        v.object({
          round: literals(PLAYOFF_ROUNDS),
          conference: v.union(vConference, v.null()),
          home: vSide,
          away: vSide,
          winner: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) return null;
    const teams = await teamsById(ctx);
    const [standings, scores] = await Promise.all([
      seasonStandings(ctx, franchise, season, teams),
      seasonScores(ctx, seasonId, teams),
    ]);
    const rows: (StandingRow & { team: (typeof standings)[number]["team"] })[] = standings.map((s) => ({
      ...s,
      teamAbbr: s.team.abbr,
    }));
    // A franchise season lists the whole league from kickoff, so the projection always has a field.
    if (season.year >= franchise.startYear) {
      const listed = new Set(rows.map((r) => r.teamAbbr));
      const alignment = leagueAlignment(season.year);
      for (const team of teams.values()) {
        if (listed.has(team.abbr) || !alignment.has(team.abbr)) continue;
        rows.push({
          team: toTeamRef(team),
          teamAbbr: team.abbr,
          ...alignmentFor(season.year, team),
          w: 0,
          l: 0,
          t: 0,
        });
      }
    }
    if (rows.length === 0) return null;
    const { projection, bracket, results } = seasonBoard(season.year, rows, scores);
    return {
      year: season.year,
      final: projection.final,
      byeSeeds: projection.byeSeeds,
      rows: rows.flatMap((r) => {
        const p = projection.rows.get(r.teamAbbr);
        if (!p) return [];
        const playoffResult = r.playoffResult ?? results.get(r.teamAbbr);
        return [
          {
            team: r.team,
            conference: r.conference,
            division: r.division,
            w: r.w,
            l: r.l,
            t: r.t,
            divisionRank: p.divisionRank,
            conferenceRank: p.conferenceRank,
            seed: p.seed,
            clinch: p.clinch,
            ...(playoffResult ? { playoffResult } : {}),
          },
        ];
      }),
      bracket: bracket.map((g) => ({
        round: g.round,
        conference: g.conference,
        home: { abbr: g.home.teamAbbr, seed: g.home.seed },
        away: { abbr: g.away.teamAbbr, seed: g.away.seed },
        winner: g.winner,
      })),
    };
  },
});

/**
 * League (FEATURES.md 5.6): a season's standings and bracket, every season's champions, and the
 * all-time table. Imported and captured standings, with the user team's own row filled in from
 * its season when no standings screen was captured.
 */
import { v } from "convex/values";
import { seasonSummary } from "../../shared/games/summary";
import { alignmentFor, STANDING_DIVISIONS } from "../../shared/league/alignment";
import { championsOf, leagueTable, type StandingRow } from "../../shared/league/standings";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { franchiseSeasonList, seasonGames } from "../lib/reports";
import { literals, vConference, vPlayoffResult } from "../lib/validators";

/** 32 teams for every season the franchise knows, with headroom. */
const MAX_ROWS = 32 * 120;
const MAX_TEAMS = 64;

const vStanding = v.object({
  team: vTeamRef,
  /** The season's alignment: 1999–2001 had six divisions (`shared/league/alignment`). */
  conference: vConference,
  division: literals(STANDING_DIVISIONS),
  w: v.number(),
  l: v.number(),
  t: v.number(),
  divisionRank: v.optional(v.number()),
  seed: v.optional(v.number()),
  playoffResult: v.optional(vPlayoffResult),
  pointsFor: v.optional(v.number()),
  pointsAgainst: v.optional(v.number()),
  /** Imported or captured, or worked out from the user team's own games. */
  source: v.union(v.literal("standings"), v.literal("season")),
});

type Standing = typeof vStanding.type;

function fromRow(row: Doc<"standings">, team: Doc<"teams">, year: number): Standing {
  return {
    team: toTeamRef(team),
    ...alignmentFor(year, team),
    w: row.w,
    l: row.l,
    t: row.t,
    divisionRank: row.divisionRank,
    seed: row.seed,
    playoffResult: row.playoffResult,
    pointsFor: row.pointsFor,
    pointsAgainst: row.pointsAgainst,
    source: "standings",
  };
}

/** The user team's row from its season record and games, for seasons with no standings captured. */
async function userRow(ctx: QueryCtx, season: Doc<"seasons">, team: Doc<"teams">): Promise<Standing | null> {
  const record = season.userRecord;
  if (!record) return null;
  const games = await seasonGames(ctx, season._id);
  const summary = games.length > 0 ? seasonSummary(games) : null;
  return {
    team: toTeamRef(team),
    ...alignmentFor(season.year, team),
    w: record.w,
    l: record.l,
    t: record.t,
    divisionRank: record.divisionRank,
    seed: record.seed,
    playoffResult: record.playoffResult,
    pointsFor: summary?.pointsFor,
    pointsAgainst: summary?.pointsAgainst,
    source: "season",
  };
}

async function seasonStandings(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
  season: Doc<"seasons">,
  teams: Map<Id<"teams">, Doc<"teams">>,
): Promise<Standing[]> {
  const rows = await ctx.db
    .query("standings")
    .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id))
    .take(MAX_TEAMS);
  const out = rows.flatMap((row) => {
    const team = teams.get(row.teamId);
    return team ? [fromRow(row, team, season.year)] : [];
  });
  const userTeam = teams.get(franchise.userTeamId);
  if (userTeam && !rows.some((r) => r.teamId === franchise.userTeamId)) {
    const own = await userRow(ctx, season, userTeam);
    if (own) out.push(own);
  }
  return out;
}

const toShared = (s: Standing): StandingRow => ({ ...s, teamAbbr: s.team.abbr });

export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(vStanding),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) return [];
    return await seasonStandings(ctx, franchise, season, await teamsById(ctx));
  },
});

const vChampion = v.union(vTeamRef, v.null());

/**
 * Every season's champions (who won the AFC, the NFC and the Super Bowl), newest first, and the
 * all-time table over the franchise's own seasons or every season including real history.
 */
export const overview = query({
  args: { includeHistory: v.boolean() },
  returns: v.object({
    startYear: v.number(),
    champions: v.array(v.object({ year: v.number(), afc: vChampion, nfc: vChampion, superBowl: vChampion })),
    table: v.array(
      v.object({
        team: vTeamRef,
        seasons: v.number(),
        w: v.number(),
        l: v.number(),
        t: v.number(),
        playoffs: v.number(),
        playoffW: v.number(),
        playoffL: v.number(),
        divisionTitles: v.number(),
        conferenceTitles: v.number(),
        superBowls: v.number(),
      }),
    ),
  }),
  handler: async (ctx, { includeHistory }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [teams, seasons, rows] = await Promise.all([
      teamsById(ctx),
      franchiseSeasonList(ctx, franchise._id),
      ctx.db
        .query("standings")
        .withIndex("by_franchiseId_and_teamId", (q) => q.eq("franchiseId", franchise._id))
        .take(MAX_ROWS),
    ]);
    const byAbbr = new Map([...teams.values()].map((t) => [t.abbr, t]));
    const ref = (abbr: string | null) => {
      const team = abbr ? byAbbr.get(abbr) : undefined;
      return team ? toTeamRef(team) : null;
    };
    const perSeason = await Promise.all(
      [...seasons]
        .sort((a, b) => b.year - a.year)
        .map(async (season) => {
          const own = rows.filter((r) => r.seasonId === season._id);
          const standings = own.flatMap((r) => {
            const team = teams.get(r.teamId);
            return team ? [toShared(fromRow(r, team, season.year))] : [];
          });
          const userTeam = teams.get(franchise.userTeamId);
          if (userTeam && !own.some((r) => r.teamId === franchise.userTeamId)) {
            const mine = await userRow(ctx, season, userTeam);
            if (mine) standings.push(toShared(mine));
          }
          return { year: season.year, rows: standings };
        }),
    );
    const counted = perSeason.filter((s) => includeHistory || s.year >= franchise.startYear);
    return {
      startYear: franchise.startYear,
      champions: perSeason
        .map((s) => ({ year: s.year, ...championsOf(s.rows) }))
        .filter((c) => c.afc || c.nfc || c.superBowl)
        .map((c) => ({ year: c.year, afc: ref(c.afc), nfc: ref(c.nfc), superBowl: ref(c.superBowl) })),
      table: leagueTable(counted).flatMap((r) => {
        const team = ref(r.teamAbbr);
        const { teamAbbr: _abbr, ...counts } = r;
        return team ? [{ team, ...counts }] : [];
      }),
    };
  },
});

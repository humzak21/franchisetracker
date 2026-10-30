/**
 * A sample franchise for tests, CI and empty local backends: a first season with a handful of
 * games (one bye, one overtime loss) and their box scores, a roster slice, real NFL history for
 * the two seasons before it (`fixtureHistory.ts`), plus an empty second season so the season
 * switcher has somewhere to go, and a second franchise for the franchise switcher
 * (`fixtureDashboard.ts`).
 *
 * Non-destructive: does nothing when a franchise the owner created exists, or when the sample
 * season already has games. Requires the teams (`league/seed:seedTeams`).
 * Run with `npx convex run dev/fixtures:seedFixtures`.
 */
import { v } from "convex/values";
import type { Position, WeekKey } from "../../shared/domain";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { createFranchise } from "../franchise/create";
import { must } from "../lib/errors";
import { seasonGames } from "../lib/reports";
import { refreshAfterGame } from "../stats/refresh";
import { recomputeCareer, recomputePlayerSeason } from "../stats/recompute";
import { teamSeasonTotals } from "../stats/teamTotals";
import { seedSampleDashboard } from "./fixtureDashboard";
import { seedSampleHistory } from "./fixtureHistory";
import { seedSampleLeague } from "./fixtureLeague";
import { SAMPLE_LINES } from "./fixtureLines";

export const SAMPLE_FRANCHISE_NAME = "Sample Franchise";
export const SAMPLE_START_YEAR = 2026;

type FixturePlayer = {
  first: string;
  last: string;
  position: Position;
  jersey: number;
  ovr: number;
  age: number;
  exp: number;
  college: string;
};

const ROSTER: FixturePlayer[] = [
  { first: "Drake", last: "Maye", position: "QB", jersey: 10, ovr: 79, age: 23, exp: 1, college: "UNC" },
  {
    first: "TreVeyon",
    last: "Henderson",
    position: "HB",
    jersey: 32,
    ovr: 76,
    age: 22,
    exp: 0,
    college: "Ohio State",
  },
  {
    first: "Stefon",
    last: "Diggs",
    position: "WR",
    jersey: 8,
    ovr: 86,
    age: 31,
    exp: 10,
    college: "Maryland",
  },
  {
    first: "DeMario",
    last: "Douglas",
    position: "WR",
    jersey: 3,
    ovr: 77,
    age: 24,
    exp: 2,
    college: "Liberty",
  },
  {
    first: "Hunter",
    last: "Henry",
    position: "TE",
    jersey: 85,
    ovr: 80,
    age: 30,
    exp: 9,
    college: "Arkansas",
  },
  {
    first: "Robert",
    last: "Spillane",
    position: "MLB",
    jersey: 14,
    ovr: 79,
    age: 29,
    exp: 7,
    college: "Western Michigan",
  },
  {
    first: "Christian",
    last: "Gonzalez",
    position: "CB",
    jersey: 0,
    ovr: 85,
    age: 23,
    exp: 2,
    college: "Oregon",
  },
  {
    first: "Andres",
    last: "Borregales",
    position: "K",
    jersey: 36,
    ovr: 74,
    age: 22,
    exp: 0,
    college: "Miami",
  },
];

/** [week, opponent abbr, user is home, user score, opponent score, overtime, opponent W-L at kickoff] */
const GAMES: [WeekKey, string, boolean, number, number, boolean, [number, number]][] = [
  ["w1", "LV", true, 31, 17, false, [0, 0]],
  ["w2", "MIA", false, 27, 24, false, [1, 0]],
  ["w3", "PIT", true, 20, 23, true, [2, 0]],
  ["w5", "BUF", false, 34, 30, false, [3, 1]],
  ["w6", "NO", true, 28, 14, false, [1, 4]],
];

async function teamId(ctx: MutationCtx, abbr: string): Promise<Id<"teams">> {
  const team = await ctx.db
    .query("teams")
    .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
    .unique();
  return must(team, `Team ${abbr}`)._id;
}

export const seedFixtures = internalMutation({
  args: {},
  returns: v.object({ seeded: v.boolean() }),
  handler: async (ctx) => {
    let franchise = await ctx.db
      .query("franchises")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .first();
    if (franchise === null) {
      const { franchiseId, seasonId } = await createFranchise(ctx, {
        name: SAMPLE_FRANCHISE_NAME,
        teamAbbr: "NE",
        startYear: SAMPLE_START_YEAR,
      });
      const coaching = {
        headCoach: "Mike Vrabel",
        offensiveCoordinator: "Josh McDaniels",
        defensiveCoordinator: "Terrell Williams",
        offensiveScheme: "West Coast",
        defensiveScheme: "4-3",
      };
      await ctx.db.patch("seasons", seasonId, { status: "regular", coaching });
      await ctx.db.insert("seasons", {
        franchiseId,
        year: SAMPLE_START_YEAR + 1,
        status: "upcoming",
        coaching,
      });
      franchise = must(await ctx.db.get("franchises", franchiseId), "Sample franchise");
    }
    // Never add sample data to a franchise the owner made.
    if (franchise.name !== SAMPLE_FRANCHISE_NAME) return { seeded: false };
    const franchiseId = franchise._id;
    const season = must(
      await ctx.db
        .query("seasons")
        .withIndex("by_franchiseId_and_year", (q) =>
          q.eq("franchiseId", franchiseId).eq("year", SAMPLE_START_YEAR),
        )
        .unique(),
      "Sample season",
    );
    const existing = await ctx.db
      .query("games")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", season._id))
      .first();
    if (existing !== null) return { seeded: false };

    const ne = franchise.userTeamId;
    const playerIds = new Map<string, Id<"players">>();
    for (const p of ROSTER) {
      const playerId = await ctx.db.insert("players", {
        franchiseId: franchise._id,
        firstName: p.first,
        lastName: p.last,
        displayName: `${p.first} ${p.last}`,
        position: p.position,
        college: p.college,
        ageAnchor: { age: p.age, year: SAMPLE_START_YEAR },
        isReal: true,
        origin: "import",
        retired: false,
        aliases: [],
      });
      playerIds.set(p.last, playerId);
      await ctx.db.insert("rosterEntries", {
        franchiseId: franchise._id,
        seasonId: season._id,
        teamId: ne,
        playerId,
        jersey: p.jersey,
        position: p.position,
        ovr: p.ovr,
        age: p.age,
        exp: p.exp,
        acquisition:
          p.exp <= 1
            ? { type: "draft", year: SAMPLE_START_YEAR - p.exp }
            : { type: "free_agent", year: SAMPLE_START_YEAR },
        status: "active",
      });
    }

    // Real seasons before the franchise, adopting the sample players created above.
    await seedSampleHistory(ctx, franchiseId, SAMPLE_START_YEAR);

    let w = 0;
    let l = 0;
    const gameIds: Id<"games">[] = [];
    for (const [weekKey, abbr, userIsHome, us, them, overtime, [ow, ol]] of GAMES) {
      const opponentTeamId = await teamId(ctx, abbr);
      const result = us > them ? "W" : us < them ? "L" : "T";
      const gameId = await ctx.db.insert("games", {
        franchiseId: franchise._id,
        seasonId: season._id,
        weekKey,
        homeTeamId: userIsHome ? ne : opponentTeamId,
        awayTeamId: userIsHome ? opponentTeamId : ne,
        opponentTeamId,
        userIsHome,
        homeScore: userIsHome ? us : them,
        awayScore: userIsHome ? them : us,
        overtime,
        result,
        opponentRecord: { w: ow, l: ol, t: 0 },
        notes: weekKey === "w1" ? "Maye opened the season hot: three touchdowns before halftime." : undefined,
        stars: [
          { playerId: playerIds.get("Maye"), caption: "Three touchdowns before halftime" },
          { playerId: playerIds.get("Diggs") },
          { rawName: "Opponent standout", caption: "2 sacks" },
        ],
        status: "played",
      });
      gameIds.push(gameId);
      for (const [last, stats] of Object.entries(SAMPLE_LINES[weekKey as keyof typeof SAMPLE_LINES])) {
        const playerId = must(playerIds.get(last), last);
        await ctx.db.insert("gameStatLines", {
          franchiseId: franchise._id,
          seasonId: season._id,
          gameId,
          playerId,
          teamId: ne,
          weekKey,
          position: ROSTER.find((p) => p.last === last)?.position,
          stats,
        });
      }
      if (result === "W") w++;
      else if (result === "L") l++;
    }
    await ctx.db.insert("games", {
      franchiseId: franchise._id,
      seasonId: season._id,
      weekKey: "w4",
      status: "bye",
    });

    // Aggregates, records, streaks and milestones come from the lines, as after a real commit.
    for (const playerId of playerIds.values()) {
      const player = must(await ctx.db.get("players", playerId), "Sample player");
      await recomputePlayerSeason(ctx, player, season._id);
      await recomputeCareer(ctx, player);
    }
    for (const gameId of gameIds) await refreshAfterGame(ctx, gameId, [...playerIds.values()]);
    await ctx.db.patch("seasons", season._id, {
      userRecord: { w, l, t: 0, divisionRank: 1 },
      teamTotals: await teamSeasonTotals(ctx, season, await seasonGames(ctx, season._id)),
    });
    await seedSampleLeague(ctx, franchiseId, season._id, SAMPLE_START_YEAR, playerIds);
    await seedSampleDashboard(ctx, franchise, season);
    return { seeded: true };
  },
});

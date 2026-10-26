/**
 * A small, realistic sample of the 2025 season for tests, CI and empty local backends: a
 * handful of games (one bye, one overtime loss), a roster slice and imported season totals.
 * The private workbook is not in the repo, so this is what Playwright sees in CI.
 *
 * Non-destructive: does nothing if the 2025 season already has games (for example after
 * the real workbook import). Run with `npx convex run dev/fixtures:seedFixtures`.
 */
import { v } from "convex/values";
import type { Position, WeekKey } from "../../shared/domain";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";

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

const SEASON_TOTALS: Record<string, Record<string, number>> = {
  Maye: {
    passCmp: 363,
    passAtt: 525,
    passYds: 4228,
    passTd: 42,
    passInt: 18,
    passSacked: 19,
    rushAtt: 28,
    rushYds: 267,
    rushTd: 5,
  },
  Henderson: {
    rushAtt: 244,
    rushYds: 1079,
    rushTd: 11,
    rushLong: 54,
    rec: 32,
    recYds: 209,
    recTd: 2,
    recLong: 35,
  },
  Diggs: { rec: 120, recYds: 1687, recTd: 21, recLong: 64 },
  Douglas: { rec: 87, recYds: 935, recTd: 10, recLong: 55 },
};

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
    const franchise = must(
      await ctx.db
        .query("franchises")
        .withIndex("by_isActive", (q) => q.eq("isActive", true))
        .first(),
      "Active franchise (run franchise/seed:seedInitial first)",
    );
    const season = must(
      await ctx.db
        .query("seasons")
        .withIndex("by_franchiseId_and_year", (q) => q.eq("franchiseId", franchise._id).eq("year", 2025))
        .unique(),
      "2025 season",
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
        ageAnchor: { age: p.age, year: 2025 },
        isReal: true,
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
        acquisition: p.exp <= 1 ? { type: "draft", year: 2025 - p.exp } : { type: "free_agent", year: 2025 },
        status: "active",
      });
    }

    let w = 0;
    let l = 0;
    for (const [weekKey, abbr, userIsHome, us, them, overtime, [ow, ol]] of GAMES) {
      const opponentTeamId = await teamId(ctx, abbr);
      const result = us > them ? "W" : us < them ? "L" : "T";
      await ctx.db.insert("games", {
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
          { playerId: playerIds.get("Maye"), caption: "22/30, 284 yds, 3 TD" },
          { playerId: playerIds.get("Diggs"), caption: "8 rec, 131 yds, 1 TD" },
          { rawName: "Opponent standout", caption: "2 sacks" },
        ],
        status: "played",
      });
      if (result === "W") w++;
      else if (result === "L") l++;
    }
    await ctx.db.insert("games", {
      franchiseId: franchise._id,
      seasonId: season._id,
      weekKey: "w4",
      status: "bye",
    });

    for (const [last, totals] of Object.entries(SEASON_TOTALS)) {
      await ctx.db.insert("seasonPlayerStats", {
        franchiseId: franchise._id,
        seasonId: season._id,
        playerId: must(playerIds.get(last), last),
        teamId: ne,
        source: "import",
        split: "regular",
        gamesPlayed: 17,
        totals,
      });
    }
    await ctx.db.patch("seasons", season._id, { userRecord: { w, l, t: 0 } });
    return { seeded: true };
  },
});

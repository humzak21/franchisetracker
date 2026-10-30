/**
 * Season stats for a few players and the four teams of the AFC East, as if captured from Madden's
 * league stats and league team stats screens, so League stats and the awards counted from it
 * have something to show.
 */
import type { Position } from "../../shared/domain";
import type { StatLine } from "../../shared/stats";
import type { LeagueTeamLine } from "../../shared/stats/leagueTeamRegistry";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** [first, last, position, team, games, stats] */
const LEAGUE: [string, string, Position, string, number, StatLine][] = [
  [
    "Josh",
    "Allen",
    "QB",
    "BUF",
    5,
    {
      passCmp: 110,
      passAtt: 165,
      passYds: 1320,
      passTd: 11,
      passInt: 3,
      rushAtt: 30,
      rushYds: 180,
      rushTd: 3,
      fumbles: 1,
    },
  ],
  ["James", "Cook", "HB", "BUF", 5, { rushAtt: 88, rushYds: 455, rushTd: 6, rec: 12, recYds: 90, recTd: 1 }],
  ["Tyreek", "Hill", "WR", "MIA", 5, { rec: 34, recTargets: 50, recYds: 498, recTd: 4 }],
  ["Zach", "Sieler", "DT", "MIA", 5, { tackles: 21, tacklesForLoss: 5, sacks: 6.5 }],
  ["Sauce", "Gardner", "CB", "NYJ", 5, { tackles: 22, defInt: 5, passDeflections: 9 }],
  ["Terrel", "Bernard", "MLB", "BUF", 5, { tackles: 48, sacks: 1, defInt: 1 }],
];

export async function seedSampleLeagueStats(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  seasonId: Id<"seasons">,
  team: (abbr: string) => Promise<Id<"teams">>,
) {
  for (const [firstName, lastName, position, abbr, gamesPlayed, stats] of LEAGUE) {
    const teamId = await team(abbr);
    const playerId = await ctx.db.insert("players", {
      franchiseId,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      position,
      isReal: true,
      origin: "import",
      retired: false,
      aliases: [],
    });
    await ctx.db.insert("rosterEntries", {
      franchiseId,
      seasonId,
      teamId,
      playerId,
      position,
      status: "active",
    });
    await ctx.db.insert("reportedSeasonStats", {
      franchiseId,
      seasonId,
      playerId,
      teamId,
      gamesPlayed,
      stats: stats as Record<string, number>,
    });
  }
}

/** Five weeks of the AFC East from the league team stats screen, every tab. */
const TEAMS: [string, LeagueTeamLine][] = [
  [
    "NE",
    {
      totalYds: 2050,
      passYds: 1330,
      rushYds: 620,
      pointsPg: 28,
      passTd: 11,
      rushTd: 6,
      firstDowns: 112,
      passYdsAllowed: 1180,
      rushYdsAllowed: 520,
      pointsAllowed: 108,
      sacks: 14,
      fumblesRecovered: 2,
      defInt: 6,
      thirdDownConv: 31,
      thirdDownAtt: 62,
      fourthDownConv: 4,
      fourthDownAtt: 6,
      twoPtConv: 1,
      twoPtAtt: 2,
      redZoneAtt: 20,
      redZoneTd: 14,
      redZoneFg: 3,
      redZoneDefAtt: 16,
      redZoneDefTd: 9,
      redZoneDefFg: 4,
      intThrown: 3,
      fumblesLost: 2,
    },
  ],
  [
    "BUF",
    {
      totalYds: 1990,
      passYds: 1320,
      rushYds: 560,
      pointsPg: 26.2,
      passTd: 11,
      rushTd: 7,
      firstDowns: 108,
      passYdsAllowed: 1260,
      rushYdsAllowed: 480,
      pointsAllowed: 120,
      sacks: 12,
      fumblesRecovered: 3,
      defInt: 4,
      thirdDownConv: 29,
      thirdDownAtt: 60,
      fourthDownConv: 3,
      fourthDownAtt: 5,
      twoPtConv: 0,
      twoPtAtt: 1,
      redZoneAtt: 19,
      redZoneTd: 13,
      redZoneFg: 4,
      redZoneDefAtt: 17,
      redZoneDefTd: 11,
      redZoneDefFg: 3,
      intThrown: 3,
      fumblesLost: 1,
    },
  ],
  [
    "MIA",
    {
      totalYds: 1720,
      passYds: 1190,
      rushYds: 430,
      pointsPg: 19.6,
      passTd: 8,
      rushTd: 3,
      firstDowns: 94,
      passYdsAllowed: 1220,
      rushYdsAllowed: 610,
      pointsAllowed: 117,
      sacks: 15,
      fumblesRecovered: 1,
      defInt: 3,
      thirdDownConv: 24,
      thirdDownAtt: 61,
      fourthDownConv: 2,
      fourthDownAtt: 5,
      twoPtConv: 1,
      twoPtAtt: 1,
      redZoneAtt: 15,
      redZoneTd: 8,
      redZoneFg: 5,
      redZoneDefAtt: 18,
      redZoneDefTd: 12,
      redZoneDefFg: 4,
      intThrown: 5,
      fumblesLost: 3,
    },
  ],
  [
    "NYJ",
    {
      totalYds: 1540,
      passYds: 1010,
      rushYds: 450,
      pointsPg: 16,
      passTd: 6,
      rushTd: 3,
      firstDowns: 86,
      passYdsAllowed: 1310,
      rushYdsAllowed: 640,
      pointsAllowed: 140,
      sacks: 9,
      fumblesRecovered: 2,
      defInt: 7,
      thirdDownConv: 22,
      thirdDownAtt: 63,
      fourthDownConv: 3,
      fourthDownAtt: 7,
      twoPtConv: 0,
      twoPtAtt: 2,
      redZoneAtt: 13,
      redZoneTd: 7,
      redZoneFg: 4,
      redZoneDefAtt: 21,
      redZoneDefTd: 15,
      redZoneDefFg: 4,
      intThrown: 6,
      fumblesLost: 2,
    },
  ],
];

export async function seedSampleLeagueTeamStats(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  seasonId: Id<"seasons">,
  team: (abbr: string) => Promise<Id<"teams">>,
) {
  for (const [abbr, stats] of TEAMS) {
    await ctx.db.insert("leagueTeamStats", {
      franchiseId,
      seasonId,
      teamId: await team(abbr),
      stats: stats as Record<string, number>,
    });
  }
}

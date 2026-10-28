/**
 * The league around the sample franchise's first season, so League, Awards, Draft and
 * Transactions have something to show in development, tests and CI: AFC East standings,
 * a few awards, league stats for a handful of rivals, moves (one trade), an injury, contracts
 * against a cap, and traded picks.
 */
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";
import { seedSampleLeagueStats, seedSampleLeagueTeamStats } from "./fixtureLeagueStats";

const CAP = 279_200_000;

/** [last name, apy, years, expires] */
const CONTRACTS: [string, number, number, number][] = [
  ["Maye", 9_200_000, 4, 2027],
  ["Diggs", 22_500_000, 3, 2027],
  ["Henry", 9_000_000, 1, 2026],
  ["Gonzalez", 3_400_000, 2, 2026],
  ["Spillane", 11_000_000, 3, 2027],
];

export async function seedSampleLeague(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  seasonId: Id<"seasons">,
  year: number,
  playerIds: ReadonlyMap<string, Id<"players">>,
) {
  const team = async (abbr: string) =>
    must(
      await ctx.db
        .query("teams")
        .withIndex("by_abbr", (q) => q.eq("abbr", abbr))
        .unique(),
      abbr,
    )._id;
  const player = (last: string) => must(playerIds.get(last), last);
  const ne = await team("NE");

  for (const [abbr, w, l, rank, pf, pa] of [
    ["NE", 4, 1, 1, 140, 108],
    ["BUF", 3, 2, 2, 131, 120],
    ["MIA", 2, 3, 3, 98, 117],
    ["NYJ", 1, 4, 4, 80, 140],
  ] as const) {
    await ctx.db.insert("standings", {
      franchiseId,
      seasonId,
      teamId: await team(abbr),
      w,
      l,
      t: 0,
      divisionRank: rank,
      pointsFor: pf,
      pointsAgainst: pa,
      source: "import",
    });
  }

  const award = (fields: {
    type: "OPOW" | "DPOW" | "ROW";
    weekKey: "w1" | "w5";
    who: string;
    statLine: string;
  }) =>
    ctx.db.insert("awards", {
      franchiseId,
      seasonId,
      weekKey: fields.weekKey,
      scope: "conference",
      type: fields.type,
      conference: "AFC",
      playerId: player(fields.who),
      teamId: ne,
      statLine: fields.statLine,
    });
  await award({ type: "OPOW", weekKey: "w1", who: "Maye", statLine: "22/30, 284 yds, 3 TD" });
  await award({ type: "ROW", weekKey: "w5", who: "Henderson", statLine: "21 car, 132 yds, 2 TD" });
  await award({ type: "DPOW", weekKey: "w5", who: "Gonzalez", statLine: "2 INT, 3 PD" });
  await seedSampleLeagueStats(ctx, franchiseId, seasonId, team);
  await seedSampleLeagueTeamStats(ctx, franchiseId, seasonId, team);

  const signed = await ctx.db.insert("transactions", {
    franchiseId,
    seasonId,
    type: "sign",
    teamId: ne,
    playersIn: [{ playerId: player("Diggs") }],
    playersOut: [],
    picksIn: [],
    picksOut: [],
    contract: { years: 3, total: 67_500_000, apy: 22_500_000, expiresYear: 2027 },
    notes: "Three years to be the No. 1 receiver.",
  });
  await ctx.db.insert("transactionPlayers", {
    franchiseId,
    seasonId,
    transactionId: signed,
    playerId: player("Diggs"),
    direction: "in",
  });
  await ctx.db.insert("transactions", {
    franchiseId,
    seasonId,
    weekKey: "w4",
    type: "trade",
    teamId: ne,
    counterpartTeamId: await team("MIA"),
    playersIn: [{ rawName: "Veteran Linebacker" }],
    playersOut: [],
    picksIn: [],
    picksOut: [{ year: year + 1, round: 5 }],
    notes: "A fifth for linebacker depth at the bye.",
  });

  await ctx.db.insert("injuries", {
    franchiseId,
    seasonId,
    weekKey: "w5",
    playerId: player("Henry"),
    teamId: ne,
    injuryType: "High ankle sprain",
    lengthWeeks: 3,
    lengthLabel: "2-4 weeks",
    onIr: false,
  });

  await ctx.db.patch("seasons", seasonId, { salaryCap: CAP });
  for (const [last, apy, years, expiresYear] of CONTRACTS) {
    const entry = (
      await ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player(last)).eq("seasonId", seasonId))
        .take(1)
    )[0];
    if (entry)
      await ctx.db.patch("rosterEntries", entry._id, {
        contract: { apy, years, total: apy * years, expiresYear },
      });
  }

  await ctx.db.insert("draftPickInventory", {
    franchiseId,
    year: year + 1,
    round: 5,
    originTeamId: ne,
    ownerTeamId: await team("MIA"),
    acquiredVia: "Trade for linebacker depth",
  });
  await ctx.db.insert("draftPickInventory", {
    franchiseId,
    year: year + 1,
    round: 3,
    originTeamId: await team("BUF"),
    ownerTeamId: ne,
    acquiredVia: "Trade down in the 2026 draft",
  });
}

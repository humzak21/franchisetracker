/**
 * Hall of Fame cases (FEATURES.md 5.7): the panel on the induction sheet, and the retired players
 * who have sat out their five seasons without a plaque.
 */
import { v } from "convex/values";
import { hofCase, hofEligible } from "../../shared/history/hofCase";
import { currentSeasonYear } from "../../shared/seasons/reports";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById } from "../lib/franchise";
import { careerWithTeam } from "../lib/hof";
import { headshotUrls } from "../lib/refs";
import { franchiseSeasonList } from "../lib/reports";
import { vPosition } from "../lib/validators";

/** Every list a long career can make, as `stats/milestones` reads them. */
const MAX_PLACEMENTS = 400;
const MAX_MARKS = 600;
/** Weekly awards over a long career, with Pro Bowls and the rest. */
const MAX_AWARDS = 300;
const MAX_ENTRIES = 300;
const MAX_ELIGIBLE = 12;
/** Retirements a season can hold: the yearly step takes fifty at a time, moves add a few. */
const MAX_RETIREMENTS = 60;

export async function playerCase(ctx: QueryCtx, franchise: Doc<"franchises">, playerId: Id<"players">) {
  const [placements, awards, marks, career] = await Promise.all([
    ctx.db
      .query("recordPlacements")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_PLACEMENTS),
    ctx.db
      .query("awards")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_AWARDS),
    ctx.db
      .query("playerMarks")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_MARKS),
    careerWithTeam(ctx, playerId, franchise.userTeamId),
  ]);
  return {
    seasons: career.years.length,
    games: career.games,
    firstYear: career.years[0] ?? null,
    lastYear: career.years.at(-1) ?? null,
    ...hofCase({ placements, awards, marks }),
  };
}

export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.object({
    seasons: v.number(),
    games: v.number(),
    firstYear: v.union(v.number(), v.null()),
    lastYear: v.union(v.number(), v.null()),
    honors: v.array(v.object({ label: v.string(), count: v.number() })),
    weekly: v.number(),
    records: v.array(v.string()),
    firsts: v.number(),
    lists: v.number(),
    marks: v.array(v.string()),
  }),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    return playerCase(ctx, franchise, playerId);
  },
});

export async function eligiblePlayers(ctx: QueryCtx, franchise: Doc<"franchises">) {
  const [seasons, entries] = await Promise.all([
    franchiseSeasonList(ctx, franchise._id),
    ctx.db
      .query("hofEntries")
      .withIndex("by_franchiseId_and_inductedYear", (q) => q.eq("franchiseId", franchise._id))
      .take(MAX_ENTRIES),
  ]);
  const year = currentSeasonYear(seasons, franchise.startYear);
  const past = seasons.filter((s) => s.year >= franchise.startYear && hofEligible(s.year, year));
  const inducted = new Set(entries.map((e) => e.playerId));
  const retired = new Map<Id<"players">, number>();
  const moves = await Promise.all(
    past.map(async (s) => ({
      year: s.year,
      rows: await ctx.db
        .query("transactions")
        .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", s._id).eq("type", "retire"))
        .take(MAX_RETIREMENTS),
    })),
  );
  for (const { year: retiredYear, rows } of moves) {
    for (const move of rows) {
      if (move.teamId !== undefined && move.teamId !== franchise.userTeamId) continue;
      for (const { playerId } of move.playersOut) {
        if (playerId && !inducted.has(playerId)) retired.set(playerId, retiredYear);
      }
    }
  }
  const newest = [...retired].sort((a, b) => b[1] - a[1]).slice(0, MAX_ELIGIBLE);
  const players = await playersById(
    ctx,
    newest.map(([id]) => id),
  );
  const photos = await headshotUrls(ctx, players.values());
  return {
    year,
    players: newest.flatMap(([id, retiredYear]) => {
      const p = players.get(id);
      // A retirement can be undone by hand on the player; the flag is the current truth.
      return p?.retired
        ? [
            {
              playerId: id,
              displayName: p.displayName,
              position: p.position,
              headshotUrl: photos.get(id) ?? null,
              retiredYear,
              newlyEligible: !hofEligible(retiredYear + 1, year),
            },
          ]
        : [];
    }),
  };
}

/** Retired with the team, five seasons gone and not on the wall: the newest class first. */
export const eligible = query({
  args: {},
  returns: v.object({
    year: v.number(),
    players: v.array(
      v.object({
        playerId: v.id("players"),
        displayName: v.string(),
        position: vPosition,
        headshotUrl: v.union(v.string(), v.null()),
        retiredYear: v.number(),
        newlyEligible: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    return eligiblePlayers(ctx, franchise);
  },
});

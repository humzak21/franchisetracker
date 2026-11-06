/** Where players are this season and last: the context a printed name is matched in. */
import { onRoster } from "../../shared/roster/averages";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** One player's place in the league, as `NameCandidate` carries it. */
export type SeasonPlace = {
  teamAbbr: string | null;
  inactive: boolean;
  inLeague: boolean | undefined;
  lastTeamAbbr: string | null;
};

/** A season with most teams' rosters in, so a player on none of them is a real signal. */
const LOADED_SHARE = 0.75;
/** A player is on a handful of entries a season at most: traded, released, signed again. */
const ENTRIES_PER_SEASON = 10;

export type LeagueSeason = {
  seasonId: Id<"seasons">;
  lastSeasonId: Id<"seasons"> | null;
  abbrById: Map<Id<"teams">, string>;
  loaded: boolean;
};

/** The season, the one before it, and whether the league's rosters are in. One read per team. */
export async function leagueSeason(
  ctx: QueryCtx,
  season: Doc<"seasons">,
  teams: Iterable<Doc<"teams">>,
): Promise<LeagueSeason> {
  const all = [...teams];
  const last = await ctx.db
    .query("seasons")
    .withIndex("by_franchiseId_and_year", (q) =>
      q.eq("franchiseId", season.franchiseId).eq("year", season.year - 1),
    )
    .unique();
  const rostered = await Promise.all(
    all.map((team) =>
      ctx.db
        .query("rosterEntries")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id).eq("teamId", team._id))
        .first(),
    ),
  );
  return {
    seasonId: season._id,
    lastSeasonId: last?._id ?? null,
    abbrById: new Map(all.map((t) => [t._id, t.abbr])),
    loaded: rostered.filter(Boolean).length >= all.length * LOADED_SHARE,
  };
}

async function placeIn(ctx: QueryCtx, playerId: Id<"players">, seasonId: Id<"seasons">) {
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
    .take(ENTRIES_PER_SEASON);
  return entries.find((e) => onRoster(e.status)) ?? entries.at(-1) ?? null;
}

/** Where a player found by name is: their team this season (or none), and last season's. */
export async function seasonPlace(
  ctx: QueryCtx,
  league: LeagueSeason,
  playerId: Id<"players">,
): Promise<SeasonPlace> {
  const now = await placeIn(ctx, playerId, league.seasonId);
  const before = league.lastSeasonId ? await placeIn(ctx, playerId, league.lastSeasonId) : null;
  return {
    teamAbbr: now ? (league.abbrById.get(now.teamId) ?? null) : null,
    inactive: now ? !onRoster(now.status) : false,
    inLeague: league.loaded ? now !== null && onRoster(now.status) : undefined,
    lastTeamAbbr: before ? (league.abbrById.get(before.teamId) ?? null) : null,
  };
}

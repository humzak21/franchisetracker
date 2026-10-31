/**
 * The awards race (FEATURES.md 5.8): who leads MVP, OPOY, DPOY and OROY on the season's numbers,
 * from our logs, captured season stats and the league leaders screens. Counted live, like the
 * counted awards, and it only ever reads: Madden's winners come from its awards screen.
 */
import { v } from "convex/values";
import { awardsRace, RACE_AWARDS, raceEntrants } from "../../shared/awards/race";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { leagueSeasonLines } from "../lib/leagueStats";
import { headshotUrls, toTeamRef, vTeamRef } from "../lib/refs";
import { vAwardType, vPosition } from "../lib/validators";

/** A top twenty for every stat a leaders screen can show, with headroom. */
const MAX_LEADERS = 3000;

export async function seasonRace(ctx: QueryCtx, franchise: Doc<"franchises">, season: Doc<"seasons">) {
  const seasonId = season._id;
  const [lines, leaders, teams] = await Promise.all([
    leagueSeasonLines(ctx, franchise, seasonId),
    ctx.db
      .query("leagueLeaders")
      .withIndex("by_seasonId_and_statKey_and_rank", (q) => q.eq("seasonId", seasonId))
      .take(MAX_LEADERS),
    teamsById(ctx),
  ]);
  const known = await playersById(ctx, [
    ...lines.map((l) => l.playerId),
    ...leaders.flatMap((l) => (l.playerId ? [l.playerId] : [])),
  ]);
  const race = awardsRace(
    raceEntrants(lines, leaders, (id) => {
      const player = known.get(id);
      return player ? { position: player.position, rookie: player.draft?.year === season.year } : null;
    }),
    (teamId) => teamId === franchise.userTeamId,
  );
  const shown = await playersById(
    ctx,
    RACE_AWARDS.flatMap((type) => race[type].map((r) => r.playerId)),
  );
  const photos = await headshotUrls(ctx, shown.values());
  return RACE_AWARDS.map((type) => ({
    type,
    rows: race[type].flatMap((r) => {
      const player = shown.get(r.playerId);
      const team = teams.get(r.teamId);
      if (!player) return [];
      return [
        {
          rank: r.rank,
          player: {
            _id: player._id,
            displayName: player.displayName,
            position: r.position,
            headshotUrl: photos.get(r.playerId) ?? null,
          },
          team: team ? toTeamRef(team) : null,
          isUser: r.teamId === franchise.userTeamId,
          value: r.value,
          behind: r.behind,
          games: r.games,
          statLine: r.statLine,
          partial: r.partial,
        },
      ];
    }),
  }));
}

export const bySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      type: vAwardType,
      rows: v.array(
        v.object({
          rank: v.number(),
          player: v.object({
            _id: v.id("players"),
            displayName: v.string(),
            position: vPosition,
            headshotUrl: v.union(v.string(), v.null()),
          }),
          team: v.union(vTeamRef, v.null()),
          isUser: v.boolean(),
          value: v.number(),
          behind: v.number(),
          games: v.number(),
          statLine: v.union(v.string(), v.null()),
          partial: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) return [];
    return seasonRace(ctx, franchise, season);
  },
});

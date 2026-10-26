/** Compare (FEATURES.md 5.4): two to four players' careers side by side, imported seasons included. */
import { v } from "convex/values";
import { preferLogs, summarizeSeasons, type StatLine } from "../../shared/stats";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { teamsById } from "../lib/franchise";
import { headshotUrl } from "../lib/media";
import { seasonYears, toTeamRef, vTeamRef } from "../lib/refs";
import { vPosition, vStatMap } from "../lib/validators";

const MAX_ROWS = 160;
const vCareer = v.object({ seasons: v.number(), games: v.number(), totals: vStatMap });

export const get = query({
  args: { playerIds: v.array(v.id("players")) },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      displayName: v.string(),
      position: vPosition,
      isReal: v.boolean(),
      headshotUrl: v.union(v.string(), v.null()),
      team: v.union(vTeamRef, v.null()),
      firstYear: v.union(v.number(), v.null()),
      lastYear: v.union(v.number(), v.null()),
      regular: vCareer,
      postseason: vCareer,
    }),
  ),
  handler: async (ctx, { playerIds }) => {
    await requireOwner(ctx);
    if (playerIds.length < 1 || playerIds.length > 4) throw invalid("Compare one to four players");
    const teams = await teamsById(ctx);
    return await Promise.all(
      [...new Set(playerIds)].map(async (playerId) => {
        const player = must(await ctx.db.get("players", playerId), "Player");
        const rows = await ctx.db
          .query("seasonPlayerStats")
          .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
          .take(MAX_ROWS);
        const years = await seasonYears(
          ctx,
          rows.map((r) => r.seasonId),
        );
        const dated = rows.flatMap((r) => {
          const year = years.get(r.seasonId);
          return year === undefined ? [] : [{ ...r, year, teamKey: r.teamId as string }];
        });
        const career = (split: "regular" | "postseason") => {
          const seasons = preferLogs(dated.filter((r) => r.split === split));
          const summary = summarizeSeasons(
            seasons.map((s) => ({
              gamesPlayed: s.gamesPlayed,
              totals: s.totals as StatLine,
              thresholdCounts: {},
              bests: {},
            })),
          );
          return {
            seasons: new Set(seasons.map((s) => s.year)).size,
            games: summary.gamesPlayed,
            totals: summary.totals,
          };
        };
        const latest = [...dated].sort((a, b) => b.year - a.year)[0];
        const team = latest ? teams.get(latest.teamId) : undefined;
        const allYears = dated.map((r) => r.year);
        return {
          playerId,
          displayName: player.displayName,
          position: player.position,
          isReal: player.isReal,
          headshotUrl: await headshotUrl(ctx, player),
          team: team ? toTeamRef(team) : null,
          firstYear: allYears.length ? Math.min(...allYears) : null,
          lastYear: allYears.length ? Math.max(...allYears) : null,
          regular: career("regular"),
          postseason: career("postseason"),
        };
      }),
    );
  },
});

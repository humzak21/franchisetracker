/** Fastest-to lists (`shared/stats/marks.ts`): each mark's list reads one index, already in order. */
import { v } from "convex/values";
import {
  MARK_STATS,
  MARKS,
  rankMarks,
  RECORD_TOP,
  type MarkHorizon,
  type MarkStat,
} from "../../shared/stats";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById } from "../lib/franchise";
import { literals, vMarkHorizon, vPosition, vWeekKey } from "../lib/validators";
import { franchiseSeasons } from "./load";

const vMarkStat = literals(MARK_STATS as unknown as readonly [MarkStat, ...MarkStat[]]);

export type SeasonYears = ReadonlyMap<Id<"seasons">, number>;

export async function seasonYears(ctx: QueryCtx, franchiseId: Id<"franchises">): Promise<SeasonYears> {
  const seasons = await franchiseSeasons(ctx, franchiseId);
  return new Map(seasons.map((s) => [s._id, s.year]));
}

/** One mark's top twenty, ranked. */
export async function fastestList(
  ctx: QueryCtx,
  franchiseId: Id<"franchises">,
  years: SeasonYears,
  statKey: string,
  mark: number,
  horizon: MarkHorizon,
) {
  const rows = await ctx.db
    .query("playerMarks")
    .withIndex("by_franchiseId_and_statKey_and_mark_and_horizon_and_gamesToReach", (q) =>
      q.eq("franchiseId", franchiseId).eq("statKey", statKey).eq("mark", mark).eq("horizon", horizon),
    )
    .take(RECORD_TOP);
  return rankMarks(rows.map((r) => ({ ...r, year: years.get(r.seasonId) ?? 0 })));
}

export const lists = query({
  args: { statKey: vMarkStat, horizon: vMarkHorizon },
  returns: v.array(
    v.object({
      mark: v.number(),
      entries: v.array(
        v.object({
          rank: v.number(),
          player: v.object({ playerId: v.id("players"), name: v.string(), position: vPosition }),
          gamesToReach: v.number(),
          year: v.number(),
          weekKey: vWeekKey,
          gameId: v.id("games"),
        }),
      ),
    }),
  ),
  handler: async (ctx, { statKey, horizon }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const years = await seasonYears(ctx, franchise._id);
    const found = await Promise.all(
      MARKS[statKey].map(async (mark) => ({
        mark,
        entries: await fastestList(ctx, franchise._id, years, statKey, mark, horizon),
      })),
    );
    const players = await playersById(
      ctx,
      found.flatMap((l) => l.entries.map((e) => e.playerId)),
    );
    return found
      .filter((l) => l.entries.length > 0)
      .map(({ mark, entries }) => ({
        mark,
        entries: entries.flatMap((e) => {
          const p = players.get(e.playerId);
          if (!p) return [];
          return [
            {
              rank: e.rank,
              player: { playerId: p._id, name: p.displayName, position: p.position },
              gamesToReach: e.gamesToReach,
              year: e.year,
              weekKey: e.weekKey,
              gameId: e.gameId,
            },
          ];
        }),
      }));
  },
});

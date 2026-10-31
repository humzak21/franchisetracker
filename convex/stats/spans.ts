/** Best-span lists (`shared/stats/spans.ts`): every window of one stat, and a player's places on them. */
import { v } from "convex/values";
import {
  MARK_STATS,
  RECORD_TOP,
  sharedRanks,
  SPAN_WINDOWS,
  streakSpanLabel,
  type MarkStat,
} from "../../shared/stats";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById } from "../lib/franchise";
import { literals, vPosition, vStatSplit } from "../lib/validators";

const vSpanStat = literals(MARK_STATS as unknown as readonly [MarkStat, ...MarkStat[]]);
/** Two splits of every stat and window. */
const MAX_BOARDS = 200;

type Entry = Doc<"spanBoards">["top"][number];

const spanOf = (e: Entry) =>
  streakSpanLabel({ year: e.startYear, weekKey: e.startWeek }, { year: e.endYear, weekKey: e.endWeek }) ?? "";

export const lists = query({
  args: { split: vStatSplit, statKey: vSpanStat },
  returns: v.array(
    v.object({
      window: v.number(),
      entries: v.array(
        v.object({
          rank: v.number(),
          player: v.object({ playerId: v.id("players"), name: v.string(), position: vPosition }),
          value: v.number(),
          span: v.string(),
          crossesSeasons: v.boolean(),
          startGameId: v.id("games"),
        }),
      ),
    }),
  ),
  handler: async (ctx, { split, statKey }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const boards = await Promise.all(
      SPAN_WINDOWS.map((window) =>
        ctx.db
          .query("spanBoards")
          .withIndex("by_franchiseId_and_split_and_statKey_and_window", (q) =>
            q.eq("franchiseId", franchise._id).eq("split", split).eq("statKey", statKey).eq("window", window),
          )
          .unique(),
      ),
    );
    const shown = boards.flatMap((b) => (b ? [{ ...b, top: b.top.slice(0, RECORD_TOP) }] : []));
    const players = await playersById(
      ctx,
      shown.flatMap((b) => b.top.map((e) => e.playerId)),
    );
    return shown
      .filter((b) => b.top.length > 0)
      .map((board) => ({
        window: board.window,
        entries: sharedRanks(board.top, (e) => e.value).flatMap((e) => {
          const p = players.get(e.playerId);
          if (!p) return [];
          return [
            {
              rank: e.rank,
              player: { playerId: p._id, name: p.displayName, position: p.position },
              value: e.value,
              span: spanOf(e),
              crossesSeasons: e.crossesSeasons,
              startGameId: e.startGameId,
            },
          ];
        }),
      }));
  },
});

/** Every best-span list a player makes: one read of the franchise's boards, a few dozen small rows. */
export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.array(
    v.object({
      split: vStatSplit,
      statKey: v.string(),
      window: v.number(),
      rank: v.number(),
      value: v.number(),
      span: v.string(),
    }),
  ),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const boards = await ctx.db
      .query("spanBoards")
      .withIndex("by_franchiseId_and_split_and_statKey_and_window", (q) => q.eq("franchiseId", franchise._id))
      .take(MAX_BOARDS);
    return boards.flatMap((board) => {
      const ranked = sharedRanks(board.top.slice(0, RECORD_TOP), (e) => e.value);
      const best = ranked.find((e) => e.playerId === playerId);
      if (!best) return [];
      const { split, statKey, window } = board;
      return [{ split, statKey, window, rank: best.rank, value: best.value, span: spanOf(best) }];
    });
  },
});

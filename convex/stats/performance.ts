/**
 * What the games add up to past the box score: marks and best spans per player, and the team's
 * record lists. Runs after a game in its own steps, a few players at a time, and every write is
 * worked out from the logs, so committing a game twice changes nothing.
 */
import { v } from "convex/values";
import { weekPhase } from "../../shared/domain";
import {
  bestSpans,
  markTitle,
  marksInGame,
  mergeSpanEntries,
  playerMarks,
  SPAN_STATS,
  SPAN_WINDOWS,
  spanEntry,
  TEAM_RECORD_STATS,
  type StatLine,
} from "../../shared/stats";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { playerLines, type Split } from "./load";
import { writeTeamRecords } from "./teamRecords";

/** Players one step re-enters: each reads his career and rewrites a few rows. */
const PLAYER_CHUNK = 8;
/** Every mark a player can hold, every horizon, a long career of seasons. */
const MAX_MARKS = 600;
const MAX_SEASON_ROWS = 120;
const SPLITS = ["regular", "postseason"] as const;
/** Players one rebuild step reads; most hold no games with the team and cost one read. */
const PERFORMANCE_PAGE = 60;
/** Two splits of every span list and every team list, with headroom. */
const MAX_BOARDS = 500;

type Line = Awaited<ReturnType<typeof playerLines>>[number];

/** The user team's games only: other teams' lines are partial, so a count over them would lie. */
async function userLines(ctx: QueryCtx, franchise: Doc<"franchises">, playerId: Id<"players">) {
  const lines = await playerLines(ctx, playerId);
  return lines.filter((l) => l.teamId === franchise.userTeamId);
}

const inSplit = (lines: readonly Line[], split: Split) => lines.filter((l) => weekPhase(l.weekKey) === split);
const logged = (l: Line) => ({ ...l, stats: l.stats as StatLine });

/** Real seasons with no log behind them: the starting total of a player's count. */
async function importedSeasons(ctx: QueryCtx, playerId: Id<"players">) {
  const rows = await ctx.db
    .query("seasonPlayerStats")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
    .take(MAX_SEASON_ROWS);
  const logged = new Set(rows.filter((r) => r.source === "logs").map((r) => r.seasonId));
  return rows
    .filter((r) => r.split === "regular" && r.source === "import" && !logged.has(r.seasonId))
    .map((r) => ({ teamId: r.teamId, gamesPlayed: r.gamesPlayed, totals: r.totals as StatLine }));
}

type Mark = ReturnType<typeof playerMarks<Id<"games">, Id<"seasons">, Id<"teams">>>[number];

const markKey = (m: Pick<Mark, "statKey" | "mark" | "horizon" | "seasonId">) =>
  `${m.statKey}|${m.mark}|${m.horizon}|${m.horizon === "season" ? m.seasonId : ""}`;

/** Rewrites one player's marks from his log, touching only what moved. Returns them. */
export async function writePlayerMarks(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  playerId: Id<"players">,
  lines: readonly Line[],
): Promise<Mark[]> {
  const season = inSplit(lines, "regular").map(logged);
  const marks = playerMarks(season, await importedSeasons(ctx, playerId), franchise.userTeamId);
  const existing = await ctx.db
    .query("playerMarks")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .take(MAX_MARKS);
  const desired = new Map(marks.map((m) => [markKey(m), m]));
  for (const row of existing) {
    const want = desired.get(markKey({ ...row, statKey: row.statKey as Mark["statKey"] }));
    desired.delete(markKey({ ...row, statKey: row.statKey as Mark["statKey"] }));
    if (!want) await ctx.db.delete("playerMarks", row._id);
    else if (
      want.gamesToReach !== row.gamesToReach ||
      want.gameId !== row.gameId ||
      want.weekKey !== row.weekKey ||
      want.seasonId !== row.seasonId
    ) {
      const { gamesToReach, gameId, weekKey, seasonId } = want;
      await ctx.db.patch("playerMarks", row._id, { gamesToReach, gameId, weekKey, seasonId });
    }
  }
  for (const m of desired.values()) {
    await ctx.db.insert("playerMarks", { franchiseId: franchise._id, playerId, ...m });
  }
  return marks;
}

async function spanBoard(
  ctx: QueryCtx,
  franchiseId: Id<"franchises">,
  split: Split,
  statKey: string,
  window: number,
) {
  return await ctx.db
    .query("spanBoards")
    .withIndex("by_franchiseId_and_split_and_statKey_and_window", (q) =>
      q.eq("franchiseId", franchiseId).eq("split", split).eq("statKey", statKey).eq("window", window),
    )
    .unique();
}

/** Re-enters these players' best spans on every board. Each stat and window is one read. */
export async function writeSpans(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  careers: ReadonlyMap<Id<"players">, readonly Line[]>,
) {
  const players = new Set<string>(careers.keys());
  for (const split of SPLITS) {
    for (const statKey of SPAN_STATS) {
      for (const window of SPAN_WINDOWS) {
        const incoming = [...careers].flatMap(([playerId, lines]) => {
          const { best, second } = bestSpans(inSplit(lines, split).map(logged), statKey, window);
          return [best, second].flatMap((s) => (s ? [spanEntry(playerId, s)] : []));
        });
        const board = await spanBoard(ctx, franchiseId, split, statKey, window);
        const top = mergeSpanEntries(board?.top ?? [], players, incoming);
        if (board && JSON.stringify(board.top) === JSON.stringify(top)) continue;
        if (board && top.length === 0) await ctx.db.delete("spanBoards", board._id);
        else if (board) await ctx.db.patch("spanBoards", board._id, { top });
        else if (top.length > 0) {
          await ctx.db.insert("spanBoards", { franchiseId, split, statKey, window, top });
        }
      }
    }
  }
}

/** Everything the rebuild writes back, so a player or a season that is gone leaves nothing behind. */
export async function clearPerformance(ctx: MutationCtx, franchiseId: Id<"franchises">) {
  const spans = await ctx.db
    .query("spanBoards")
    .withIndex("by_franchiseId_and_split_and_statKey_and_window", (q) => q.eq("franchiseId", franchiseId))
    .take(MAX_BOARDS);
  for (const board of spans) await ctx.db.delete("spanBoards", board._id);
  const team = await ctx.db
    .query("teamRecords")
    .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) => q.eq("franchiseId", franchiseId))
    .take(MAX_BOARDS);
  for (const board of team) await ctx.db.delete("teamRecords", board._id);
}

/** One page of the rebuild: marks and spans for the players on it. Returns the next cursor, or null. */
export async function performancePage(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  cursor: string | null,
): Promise<string | null> {
  const page = await ctx.db
    .query("players")
    .withIndex("by_franchiseId_and_lastName", (q) => q.eq("franchiseId", franchise._id))
    .paginate({ numItems: PERFORMANCE_PAGE, cursor });
  const careers = new Map<Id<"players">, Line[]>();
  for (const player of page.page) {
    const lines = await userLines(ctx, franchise, player._id);
    await writePlayerMarks(ctx, franchise, player._id, lines);
    if (lines.length > 0) careers.set(player._id, lines);
  }
  if (careers.size > 0) await writeSpans(ctx, franchise._id, careers);
  return page.isDone ? null : page.continueCursor;
}

type NewMilestone = Pick<Doc<"milestones">, "key" | "kind" | "title" | "playerId" | "statKey" | "value">;

async function addMilestones(
  ctx: MutationCtx,
  game: Doc<"games">,
  desired: readonly NewMilestone[],
  stale: (m: Doc<"milestones">) => boolean,
) {
  const existing = await ctx.db
    .query("milestones")
    .withIndex("by_gameId", (q) => q.eq("gameId", game._id))
    .take(300);
  const keys = new Set(desired.map((m) => m.key));
  for (const m of existing) if (stale(m) && !keys.has(m.key)) await ctx.db.delete("milestones", m._id);
  const have = new Set(existing.map((m) => m.key));
  for (const m of desired) {
    if (have.has(m.key)) continue;
    await ctx.db.insert("milestones", {
      ...m,
      franchiseId: game.franchiseId,
      seasonId: game.seasonId,
      weekKey: game.weekKey,
      gameId: game._id,
      acknowledged: false,
      detectedAt: Date.now(),
    });
  }
}

export const afterGame = internalMutation({
  args: {
    franchiseId: v.id("franchises"),
    seasonId: v.id("seasons"),
    /** Absent once the game is deleted: there is nothing left to raise a milestone on. */
    gameId: v.optional(v.id("games")),
    playerIds: v.array(v.id("players")),
  },
  returns: v.null(),
  handler: async (ctx, { franchiseId, seasonId, gameId, playerIds }) => {
    const [franchise, season, game] = await Promise.all([
      ctx.db.get("franchises", franchiseId),
      ctx.db.get("seasons", seasonId),
      gameId ? ctx.db.get("games", gameId) : null,
    ]);
    if (!franchise || !season) return null;

    const chunk = playerIds.slice(0, PLAYER_CHUNK);
    const careers = new Map<Id<"players">, Line[]>();
    const marks: NewMilestone[] = [];
    for (const playerId of chunk) {
      const lines = await userLines(ctx, franchise, playerId);
      careers.set(playerId, lines);
      const reached = await writePlayerMarks(ctx, franchise, playerId, lines);
      if (!game) continue;
      const player = await ctx.db.get("players", playerId);
      for (const m of marksInGame(reached, game._id)) {
        marks.push({
          key: `${playerId}:mark:${m.statKey}:${m.mark}`,
          kind: "mark",
          playerId,
          statKey: m.statKey,
          value: m.mark,
          title: markTitle(player?.displayName ?? "Unknown player", m),
        });
      }
    }
    await writeSpans(ctx, franchiseId, careers);
    if (game) {
      const players = new Set<string>(chunk);
      await addMilestones(ctx, game, marks, (m) => m.kind === "mark" && players.has(m.playerId ?? ""));
    }

    const rest = playerIds.slice(PLAYER_CHUNK);
    if (rest.length > 0) {
      await ctx.scheduler.runAfter(0, internal.stats.performance.afterGame, {
        franchiseId,
        seasonId,
        gameId,
        playerIds: rest,
      });
      return null;
    }
    const broken = await writeTeamRecords(ctx, franchise, season);
    if (game) {
      const here = broken.filter((b) => b.gameId === game._id);
      await addMilestones(
        ctx,
        game,
        here.map((b) => ({
          key: `team_record:${b.split}:${b.statKey}:${b.value}`,
          kind: "team_record",
          statKey: b.statKey,
          value: b.value,
          title: `Team record: ${TEAM_RECORD_STATS[b.statKey].label.toLowerCase()}, ${b.value}`,
        })),
        () => false,
      );
    }
    return null;
  },
});

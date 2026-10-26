/**
 * After a game is committed: records, streaks and milestones (FEATURES.md 4.5). Runs as its own
 * scheduled mutation so the commit stays small and this work gets a fresh read budget; screens
 * update a moment later, reactively.
 */
import { v } from "convex/values";
import { weekPhase } from "../../shared/domain";
import {
  aggregateLines,
  detectMilestones,
  formatStat,
  RECORD_SCOPE_LABELS,
  STAT_REGISTRY,
  isStatKey,
  type StatLine,
  type ThresholdOverrides,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { must } from "../lib/errors";
import { refreshRecords, type BrokenRecord } from "./refreshRecords";
import { refreshPlayerStreaks, refreshTeamStreaks } from "./refreshStreaks";

type NewMilestone = Omit<
  Doc<"milestones">,
  "_id" | "_creationTime" | "franchiseId" | "seasonId" | "acknowledged" | "detectedAt" | "weekKey" | "gameId"
>;

/** Kinds recomputed from scratch for each game; records and streaks are only ever added. */
const DERIVED_KINDS = new Set(["career_high", "threshold_game", "first_threshold_season"]);
/** Win streak lengths worth a milestone. */
const STREAK_MARKS = new Set([3, 5, 8, 10, 13, 16]);

const label = (stat: string) => (isStatKey(stat) ? STAT_REGISTRY[stat].label.toLowerCase() : stat);

async function playerMilestones(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  game: Doc<"games">,
  player: Doc<"players">,
) {
  const lines = await refreshPlayerStreaks(ctx, franchise, player);
  const index = lines.findIndex((l) => l.gameId === game._id);
  const line = lines[index];
  if (!line || line.teamId !== franchise.userTeamId) return [];
  const earlier = lines.slice(0, index);
  // Season thresholds count regular season and playoffs separately, like the season rows do.
  const sameSplit = (l: (typeof lines)[number]) => weekPhase(l.weekKey) === weekPhase(line.weekKey);
  const seasonBefore = aggregateLines(
    earlier.filter((l) => l.seasonId === game.seasonId && sameSplit(l)).map((l) => l.stats as StatLine),
  );
  const priorSeasonIds = [
    ...new Set(earlier.filter((l) => l.seasonId !== game.seasonId).map((l) => l.seasonId)),
  ];
  const priorSeasons = priorSeasonIds.map((id) =>
    aggregateLines(earlier.filter((l) => l.seasonId === id && sameSplit(l)).map((l) => l.stats as StatLine)),
  );
  return detectMilestones({
    name: player.displayName,
    line: line.stats as StatLine,
    priorGames: earlier.map((l) => l.stats as StatLine),
    seasonBefore,
    priorSeasons,
    thresholds: franchise.settings.thresholdOverrides as ThresholdOverrides | undefined,
  }).map((m) => ({ ...m, key: `${player._id}:${m.key}`, playerId: player._id }));
}

function recordMilestone(record: BrokenRecord, player: Doc<"players"> | undefined): NewMilestone {
  const split = record.split === "postseason" ? " postseason" : "";
  return {
    key: `record:${record.split}:${record.scope}:${record.statKey}:${record.value}`,
    kind: "franchise_record",
    playerId: record.playerId,
    recordId: record.recordId,
    statKey: record.statKey,
    value: record.value,
    title: `${player?.displayName ?? "Franchise"}: franchise${split} record, ${RECORD_SCOPE_LABELS[record.scope].toLowerCase()} ${label(record.statKey)} (${isStatKey(record.statKey) ? formatStat(record.statKey, record.value) : record.value})`,
  };
}

export const afterGame = internalMutation({
  args: { gameId: v.id("games"), playerIds: v.array(v.id("players")) },
  returns: v.null(),
  handler: async (ctx, { gameId, playerIds }) => {
    await refreshAfterGame(ctx, gameId, playerIds);
    return null;
  },
});

/** Records, streaks and milestones for one committed game and the players in its box score. */
export async function refreshAfterGame(
  ctx: MutationCtx,
  gameId: Id<"games">,
  playerIds: readonly Id<"players">[],
) {
  const game = await ctx.db.get("games", gameId);
  if (!game) return;
  const franchise = must(await ctx.db.get("franchises", game.franchiseId), "Franchise");
  const players = (await Promise.all(playerIds.map((id) => ctx.db.get("players", id)))).filter(
    (p): p is Doc<"players"> => p !== null,
  );

  const desired: NewMilestone[] = [];
  for (const player of players) desired.push(...(await playerMilestones(ctx, franchise, game, player)));
  const broken = await refreshRecords(ctx, franchise, game);
  const byId = new Map<Id<"players">, Doc<"players">>(players.map((p) => [p._id, p]));
  for (const record of broken)
    desired.push(
      recordMilestone(
        record,
        byId.get(record.playerId) ?? (await ctx.db.get("players", record.playerId)) ?? undefined,
      ),
    );
  const { winsBefore, winsAfter } = await refreshTeamStreaks(ctx, franchise);
  if (winsAfter > winsBefore && STREAK_MARKS.has(winsAfter)) {
    desired.push({
      key: `team:wins:${winsAfter}`,
      kind: "streak",
      statKey: "wins",
      value: winsAfter,
      title: `${winsAfter} straight wins`,
    });
  }

  const existing = await ctx.db
    .query("milestones")
    .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
    .take(300);
  const keys = new Set(desired.map((m) => m.key));
  for (const m of existing) {
    if (DERIVED_KINDS.has(m.kind) && !keys.has(m.key)) await ctx.db.delete("milestones", m._id);
  }
  const have = new Set(existing.map((m) => m.key));
  for (const m of desired) {
    if (have.has(m.key)) continue;
    await ctx.db.insert("milestones", {
      ...m,
      franchiseId: franchise._id,
      seasonId: game.seasonId,
      weekKey: game.weekKey,
      gameId,
      acknowledged: false,
      detectedAt: Date.now(),
    });
  }
}

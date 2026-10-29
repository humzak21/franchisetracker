/**
 * Editing a player's season stats by hand (FEATURES.md 5.5): one number at a time, from the
 * player page or a stats table. Where the number lives decides what an edit does:
 * - Imported real-NFL totals are changed in place, then the averages and career are worked out again.
 * - Captured season lines (League stats for other teams) are changed in place.
 * - Totals derived from game logs stay the logs' sum; the typed number is kept as the season
 *   screen's and shown in their place, the way reconciliation's "missing game" does. Clearing it
 *   goes back to the logs.
 */
import { v } from "convex/values";
import { checkStatEdit, GAMES_EDIT_KEY, summarizeSeasons, withStat, type StatLine } from "../../shared/stats";
import type { Doc } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vStatSplit } from "../lib/validators";
import { recomputeCareer } from "./recompute";

const MAX_ROWS = 20;

type Edit = { stat: string; value: number | null };

async function editImported(
  ctx: MutationCtx,
  row: Doc<"seasonPlayerStats">,
  player: Doc<"players">,
  edit: Edit,
) {
  const games = edit.stat === GAMES_EDIT_KEY ? (edit.value ?? 0) : row.gamesPlayed;
  const totals = edit.stat === GAMES_EDIT_KEY ? row.totals : withStat(row.totals, edit.stat, edit.value);
  const summary = summarizeSeasons([
    {
      gamesPlayed: games,
      totals: totals as StatLine,
      thresholdCounts: row.thresholdCounts ?? {},
      bests: row.bests ?? {},
    },
  ]);
  await ctx.db.patch("seasonPlayerStats", row._id, {
    gamesPlayed: summary.gamesPlayed,
    totals: summary.totals,
    averages: summary.averages,
  });
  await recomputeCareer(ctx, player);
}

/** A captured line's number changes; how a difference on that stat was settled no longer applies. */
async function editReported(ctx: MutationCtx, row: Doc<"reportedSeasonStats">, edit: Edit) {
  const resolved = { ...row.resolved };
  delete resolved[edit.stat];
  await ctx.db.patch("reportedSeasonStats", row._id, {
    ...(edit.stat === GAMES_EDIT_KEY
      ? { gamesPlayed: edit.value ?? undefined }
      : { stats: withStat(row.stats, edit.stat, edit.value) }),
    resolved,
  });
}

/** Log-derived totals: the typed number stands in for the logs' (cleared: the logs show again). */
async function overrideLogs(
  ctx: MutationCtx,
  logs: Doc<"seasonPlayerStats">,
  reported: Doc<"reportedSeasonStats"> | undefined,
  edit: Edit,
) {
  const logged = edit.stat === GAMES_EDIT_KEY ? logs.gamesPlayed : logs.totals[edit.stat];
  const restore = edit.value === null || edit.value === logged;
  if (!reported) {
    if (restore) return;
    await ctx.db.insert("reportedSeasonStats", {
      franchiseId: logs.franchiseId,
      seasonId: logs.seasonId,
      playerId: logs.playerId,
      teamId: logs.teamId,
      ...(edit.stat === GAMES_EDIT_KEY
        ? { gamesPlayed: edit.value ?? undefined, stats: {} }
        : { stats: { [edit.stat]: edit.value ?? 0 } }),
      resolved: { [edit.stat]: "missing" },
    });
    return;
  }
  const resolved = { ...reported.resolved };
  if (restore) delete resolved[edit.stat];
  else resolved[edit.stat] = "missing";
  await ctx.db.patch("reportedSeasonStats", reported._id, {
    ...(restore
      ? {}
      : edit.stat === GAMES_EDIT_KEY
        ? { gamesPlayed: edit.value ?? undefined }
        : { stats: withStat(reported.stats, edit.stat, edit.value) }),
    resolved,
  });
}

export const setStat = mutation({
  args: {
    playerId: v.id("players"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    split: vStatSplit,
    stat: v.string(),
    /** `null` clears the number: a captured or imported stat is removed, a log override is undone. */
    value: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { playerId, seasonId, teamId, split, stat, value }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    const season = must(await ctx.db.get("seasons", seasonId), "Season");
    if (player.franchiseId !== franchise._id || season.franchiseId !== franchise._id) {
      throw invalid("That belongs to another franchise");
    }
    const check = checkStatEdit(stat, value);
    if (!check.ok) throw invalid(check.error);
    const edit = { stat, value };

    const rows = (
      await ctx.db
        .query("seasonPlayerStats")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
        .take(MAX_ROWS)
    ).filter((r) => r.teamId === teamId && r.split === split);
    const reported = (
      await ctx.db
        .query("reportedSeasonStats")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
        .take(MAX_ROWS)
    ).find((r) => r.teamId === teamId);

    const logs = rows.find((r) => r.source === "logs");
    if (logs) {
      if (split !== "regular") throw invalid("Playoff totals come from the game logs: edit the game instead");
      await overrideLogs(ctx, logs, reported, edit);
      return null;
    }
    const imported = rows.find((r) => r.source === "import");
    if (imported) {
      await editImported(ctx, imported, player, edit);
      return null;
    }
    if (split !== "regular" || !reported) throw invalid("No stats for that season to edit");
    await editReported(ctx, reported, edit);
    return null;
  },
});

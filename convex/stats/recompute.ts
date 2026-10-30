/**
 * Rebuilds the materialized aggregates from game logs (FEATURES.md 4.5). Idempotent: each call
 * replaces a player's log-derived rows for a season, then their career rows, from scratch.
 * Imported season totals (`source: "import"`) are never touched.
 */
import { positionGroupOf, weekPhase, type Position } from "../../shared/domain";
import { preferLogs, seasonHighs, summarizeGames, summarizeSeasons, type StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** A full season plus playoffs for one player, with room for a mid-season trade. */
const MAX_LINES_PER_SEASON = 40;
const MAX_SEASON_ROWS = 120;

type Split = "regular" | "postseason";

function splitOf(line: Doc<"gameStatLines">): Split | null {
  const phase = weekPhase(line.weekKey);
  // Preseason and the Pro Bowl never count toward season or career totals.
  return phase === "regular" || phase === "postseason" ? phase : null;
}

/** The position a player played most in these lines, falling back to their listed position. */
function mostPlayed(lines: readonly Doc<"gameStatLines">[], fallback: Position): Position {
  const counts = new Map<Position, number>();
  for (const line of lines)
    if (line.position) counts.set(line.position, (counts.get(line.position) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

export async function recomputePlayerSeason(
  ctx: MutationCtx,
  player: Doc<"players">,
  seasonId: Id<"seasons">,
): Promise<void> {
  const lines = await ctx.db
    .query("gameStatLines")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", seasonId))
    .take(MAX_LINES_PER_SEASON);
  const existing = await ctx.db
    .query("seasonPlayerStats")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", seasonId))
    .take(MAX_SEASON_ROWS);
  for (const row of existing) if (row.source === "logs") await ctx.db.delete("seasonPlayerStats", row._id);

  const groups = new Map<string, { teamId: Id<"teams">; split: Split; lines: Doc<"gameStatLines">[] }>();
  for (const line of lines) {
    const split = splitOf(line);
    if (!split) continue;
    const key = `${line.teamId}|${split}`;
    const group = groups.get(key) ?? { teamId: line.teamId, split, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }
  for (const { teamId, split, lines: group } of groups.values()) {
    const summary = summarizeGames(group.map((l) => l.stats as StatLine));
    const position = mostPlayed(group, player.position);
    await ctx.db.insert("seasonPlayerStats", {
      franchiseId: player.franchiseId,
      seasonId,
      playerId: player._id,
      teamId,
      source: "logs",
      split,
      position,
      positionGroup: positionGroupOf(position),
      ...summary,
      bestGames: seasonHighs(
        group.map((l) => ({ gameId: l.gameId, weekKey: l.weekKey, line: l.stats as StatLine })),
      ),
    });
  }
}

type DatedRow = Doc<"seasonPlayerStats"> & { year: number; teamKey: Id<"teams"> };

/** What a career recompute read and wrote, for callers that rank careers too (`stats/recordBuild`). */
export type CareerRecompute = { rows: DatedRow[]; careers: Doc<"careerPlayerStats">[] };

/** The team a player played the most games for, the later one on a tie. */
function mainTeam(rows: readonly DatedRow[]): Id<"teams"> | undefined {
  const games = new Map<Id<"teams">, { games: number; year: number }>();
  for (const r of rows) {
    const t = games.get(r.teamId) ?? { games: 0, year: 0 };
    games.set(r.teamId, { games: t.games + r.gamesPlayed, year: Math.max(t.year, r.year) });
  }
  let best: [Id<"teams">, { games: number; year: number }] | undefined;
  for (const entry of games) {
    if (
      !best ||
      entry[1].games > best[1].games ||
      (entry[1].games === best[1].games && entry[1].year > best[1].year)
    )
      best = entry;
  }
  return best?.[0];
}

/** Career rows per split from season rows, preferring log-derived seasons over imported ones. */
export async function recomputeCareer(ctx: MutationCtx, player: Doc<"players">): Promise<CareerRecompute> {
  const seasonRows = await ctx.db
    .query("seasonPlayerStats")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id))
    .take(MAX_SEASON_ROWS);
  const years = new Map<Id<"seasons">, number>();
  for (const id of new Set(seasonRows.map((r) => r.seasonId))) {
    const season = await ctx.db.get("seasons", id);
    if (season) years.set(id, season.year);
  }
  const existing = await ctx.db
    .query("careerPlayerStats")
    .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
    .take(4);
  for (const row of existing) await ctx.db.delete("careerPlayerStats", row._id);

  const dated: DatedRow[] = seasonRows
    .filter((r) => years.has(r.seasonId))
    .map((r) => ({ ...r, year: years.get(r.seasonId) ?? 0, teamKey: r.teamId }));
  const careers: Doc<"careerPlayerStats">[] = [];
  for (const split of ["regular", "postseason"] as const) {
    const rows = preferLogs(dated.filter((r) => r.split === split));
    if (rows.length === 0) continue;
    const yearsPlayed = rows.map((r) => r.year);
    const summary = summarizeSeasons(
      rows.map((r) => ({
        gamesPlayed: r.gamesPlayed,
        totals: r.totals as StatLine,
        thresholdCounts: r.thresholdCounts ?? {},
        bests: r.bests ?? {},
      })),
    );
    const teamId = mainTeam(rows);
    const id = await ctx.db.insert("careerPlayerStats", {
      franchiseId: player.franchiseId,
      playerId: player._id,
      seasons: new Set(yearsPlayed).size,
      firstYear: Math.min(...yearsPlayed),
      lastYear: Math.max(...yearsPlayed),
      ...(teamId ? { teamId } : {}),
      split,
      position: player.position,
      positionGroup: positionGroupOf(player.position),
      ...summary,
    });
    const career = await ctx.db.get("careerPlayerStats", id);
    if (career) careers.push(career);
  }
  return { rows: dated, careers };
}

/** Twenty seasons of a long career, playoffs included. */
const MAX_PLAYER_LINES = 600;

/** Every log-derived row of one player, from his lines. */
export async function rebuildPlayer(ctx: MutationCtx, player: Doc<"players">) {
  const lines = await ctx.db
    .query("gameStatLines")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id))
    .take(MAX_PLAYER_LINES);
  const rows = await ctx.db
    .query("seasonPlayerStats")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id))
    .take(MAX_SEASON_ROWS);
  // Seasons with logs, plus any log-derived row whose lines are gone, so a stale row is dropped.
  const seasonIds = new Set([
    ...lines.map((l) => l.seasonId),
    ...rows.filter((r) => r.source === "logs").map((r) => r.seasonId),
  ]);
  // Imported history alone has nothing log-derived to rebuild.
  if (seasonIds.size === 0) return;
  for (const seasonId of seasonIds) await recomputePlayerSeason(ctx, player, seasonId);
  await recomputeCareer(ctx, player);
}

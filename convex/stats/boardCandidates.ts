/**
 * Turns stored rows into records-board updates (`shared/stats/recordBoards.ts`): the team book
 * counts the user team's rows of every season, real seasons before the franchise included; the
 * all-time book counts every team's rows, Madden's league leaders screens and career totals.
 */
import {
  aggregateLines,
  careerCandidates,
  isStatKey,
  keepBest,
  preferLogs,
  RECORD_STATS,
  seasonCandidates,
  type BoardBook,
  type RawStatKey,
  type StatLine,
  type StatRow,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { BoardEntry, BoardUpdate } from "./boards";
import type { Split } from "./load";
import { recomputeCareer } from "./recompute";

const SPLITS = ["regular", "postseason"] as const;
/** One season of the whole league, both splits, with headroom. */
const MAX_SEASON_ROWS = 8000;
const MAX_LEADERS = 3000;
/** A player's seasons with every team, playoffs included. */
const MAX_PLAYER_ROWS = 80;

type Row = StatRow<Id<"players">, Id<"seasons">, Id<"teams">, Id<"games">>;

export const toStatRow = (row: Doc<"seasonPlayerStats">, year: number): Row => ({
  playerId: row.playerId,
  seasonId: row.seasonId,
  year,
  teamId: row.teamId,
  gamesPlayed: row.gamesPlayed,
  totals: row.totals as StatLine,
  bests: row.bests ?? {},
  topGames: row.topGames,
});

/**
 * Season and single-game updates for one book and split from season rows. Within one season a
 * captured season (logs) replaces the imported one for the same team, as careers do.
 */
export function seasonUpdates(
  book: BoardBook,
  split: Split,
  rows: readonly (Doc<"seasonPlayerStats"> & { year: number })[],
): BoardUpdate[] {
  const kept = preferLogs(
    rows.filter((r) => r.split === split).map((r) => ({ ...r, teamKey: `${r.playerId}|${r.teamId}` })),
  );
  const candidates = seasonCandidates(kept.map((r) => toStatRow(r, r.year)));
  return (["season", "game"] as const).flatMap((scope) =>
    [...candidates[scope]].map(([statKey, entries]) => ({ book, split, scope, statKey, entries })),
  );
}

/** Career updates from per-player totals. */
export function careerUpdates(
  book: BoardBook,
  split: Split,
  rows: readonly {
    playerId: Id<"players">;
    totals: StatLine;
    firstYear: number;
    lastYear: number;
    teamId?: Id<"teams">;
  }[],
): BoardUpdate[] {
  return [...careerCandidates(rows)].map(([statKey, entries]) => ({
    book,
    split,
    scope: "career" as const,
    statKey,
    entries: entries as BoardEntry[],
  }));
}

/** A player's career with the user team: every season with it, imported or captured. */
export function teamCareer(
  rows: readonly (Doc<"seasonPlayerStats"> & { year: number })[],
  split: Split,
  userTeamId: Id<"teams">,
) {
  const kept = preferLogs(
    rows
      .filter((r) => r.split === split && r.teamId === userTeamId)
      .map((r) => ({ ...r, teamKey: r.teamId })),
  );
  if (kept.length === 0) return null;
  const years = kept.map((r) => r.year);
  return {
    playerId: kept[0]!.playerId,
    totals: aggregateLines(kept.map((r) => r.totals as StatLine)),
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
    teamId: userTeamId,
  };
}

/** Season entries from Madden's league leaders screens: the players nobody captured a box score for. */
export function leaderUpdates(
  leaders: readonly Doc<"leagueLeaders">[],
  season: { _id: Id<"seasons">; year: number },
): BoardUpdate[] {
  const byStat = new Map<RawStatKey, BoardEntry[]>();
  for (const l of leaders) {
    if (!l.playerId || !isStatKey(l.statKey) || !(RECORD_STATS as readonly string[]).includes(l.statKey))
      continue;
    const stat = l.statKey as RawStatKey;
    const entry = {
      playerId: l.playerId,
      value: l.value,
      year: season.year,
      seasonId: season._id,
      teamId: l.teamId,
    };
    byStat.set(stat, [...(byStat.get(stat) ?? []), entry]);
  }
  return [...byStat].map(([statKey, entries]) => ({
    book: "league" as const,
    split: "regular" as const,
    scope: "season" as const,
    statKey,
    entries,
  }));
}

/** A player's career entries for both books, from a fresh career recompute. */
export async function careerBoards(ctx: MutationCtx, franchise: Doc<"franchises">, player: Doc<"players">) {
  const { rows, careers } = await recomputeCareer(ctx, player);
  return SPLITS.flatMap((split) => {
    const league = careers
      .filter((c) => c.split === split)
      .map((c) => ({
        playerId: c.playerId,
        totals: c.totals,
        firstYear: c.firstYear ?? 0,
        lastYear: c.lastYear ?? 0,
        teamId: c.teamId,
      }));
    const team = teamCareer(rows, split, franchise.userTeamId);
    return [...careerUpdates("league", split, league), ...careerUpdates("team", split, team ? [team] : [])];
  });
}

/** A season's season and single-game entries for both books. */
export async function seasonBoards(ctx: MutationCtx, franchise: Doc<"franchises">, season: Doc<"seasons">) {
  const [rows, leaders] = await Promise.all([
    ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id))
      .take(MAX_SEASON_ROWS),
    ctx.db
      .query("leagueLeaders")
      .withIndex("by_seasonId_and_statKey_and_rank", (q) => q.eq("seasonId", season._id))
      .take(MAX_LEADERS),
  ]);
  const dated = rows.map((r) => ({ ...r, year: season.year }));
  const ours = dated.filter((r) => r.teamId === franchise.userTeamId);
  const league = SPLITS.flatMap((split) => seasonUpdates("league", split, dated));
  const fromLeaders = leaderUpdates(leaders, season);
  return [
    ...SPLITS.flatMap((split) => seasonUpdates("team", split, ours)),
    // A leaders screen and the captured games can both know a season: the bigger number wins.
    ...league.map((u) => {
      const extra = fromLeaders.find(
        (l) => l.split === u.split && l.scope === u.scope && l.statKey === u.statKey,
      );
      return extra ? { ...u, entries: keepBest([...u.entries, ...extra.entries]) } : u;
    }),
    ...fromLeaders.filter(
      (l) => !league.some((u) => u.split === l.split && u.scope === l.scope && u.statKey === l.statKey),
    ),
  ];
}

export async function playerBoards(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  season: Doc<"seasons">,
  years: ReadonlyMap<Id<"seasons">, number>,
  playerId: Id<"players">,
  split: Split,
): Promise<BoardUpdate[]> {
  const [rows, careers] = await Promise.all([
    ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
      .take(MAX_PLAYER_ROWS),
    ctx.db
      .query("careerPlayerStats")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(4),
  ]);
  const dated = rows.flatMap((r) => (years.has(r.seasonId) ? [{ ...r, year: years.get(r.seasonId)! }] : []));
  const thisSeason = dated.filter((r) => r.seasonId === season._id);
  const career = careers.find((c) => c.split === split);
  const team = teamCareer(dated, split, franchise.userTeamId);
  const books: [BoardBook, typeof thisSeason][] = [
    ["league", thisSeason],
    ["team", thisSeason.filter((r) => r.teamId === franchise.userTeamId)],
  ];
  return [
    ...books.flatMap(([book, inSeason]) => seasonUpdates(book, split, inSeason)),
    ...careerUpdates(
      "league",
      split,
      career
        ? [
            {
              playerId,
              totals: career.totals,
              firstYear: career.firstYear ?? season.year,
              lastYear: career.lastYear ?? season.year,
              teamId: career.teamId,
            },
          ]
        : [],
    ),
    ...careerUpdates("team", split, team ? [team] : []),
  ];
}

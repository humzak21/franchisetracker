/** Streaks with their dates (FEATURES.md 5.5): what is running now and the longest ever, or in a season. */
import { v } from "convex/values";
import { currentSeasonYear } from "../../shared/seasons/reports";
import {
  MIN_ACTIVE_STREAK,
  PLAYER_STREAKS,
  playerStreaks,
  rankRuns,
  SEASON_STREAKS,
  STREAK_LIST_SIZE,
  streakPointLabel,
  streakSpanLabel,
  TEAM_STREAKS,
  teamStreaks,
  type StatLine,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { must } from "../lib/errors";
import { activeFranchise, MAX_ROSTER, playersById } from "../lib/franchise";
import { vPosition } from "../lib/validators";
import { franchiseSeasons, orderedSeasonGames } from "./load";
import { teamGames } from "./refreshStreaks";

/** Every kind a team or a player can hold, with headroom. */
const MAX_PER_HOLDER = 40;
/** The user team's lines in one game. */
const MAX_GAME_LINES = 80;
const ON_THE_TEAM = new Set<Doc<"rosterEntries">["status"]>(["active", "ir", "practice_squad"]);

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());
const vHolder = v.object({ _id: v.id("players"), name: v.string(), position: vPosition });
const vStreak = v.object({
  key: v.string(),
  current: v.number(),
  longest: v.number(),
  /** Where the running streak began, and the longest run's two ends; null on rows from before dates. */
  since: nullable(v.string()),
  span: nullable(v.string()),
});

/** Level runs in registry order, so the rarer kinds come before a starter's games played. */
const kindOrder = (key: string) => PLAYER_STREAKS.findIndex((k) => k.key === key);

const holderOf = (p: Doc<"players">) => ({ _id: p._id, name: p.displayName, position: p.position });

function view(row: Doc<"streaks">) {
  return {
    key: row.key,
    current: row.current,
    longest: row.longest,
    since: row.currentFrom ? streakPointLabel(row.currentFrom) : null,
    span: streakSpanLabel(row.longestFrom, row.longestTo),
  };
}

const teamRows = async (ctx: QueryCtx, franchiseId: Id<"franchises">) =>
  await ctx.db
    .query("streaks")
    .withIndex("by_franchiseId_and_playerId", (q) =>
      q.eq("franchiseId", franchiseId).eq("playerId", undefined),
    )
    .take(MAX_PER_HOLDER);

/** Who is on the team now: a run ended the day a player left, whatever his row still says. */
async function rosteredPlayers(ctx: QueryCtx, franchise: Doc<"franchises">) {
  const seasons = await franchiseSeasons(ctx, franchise._id);
  const year = currentSeasonYear(seasons, franchise.startYear);
  const season = seasons.find((s) => s.year === year);
  if (!season) return [];
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_seasonId_and_teamId", (q) =>
      q.eq("seasonId", season._id).eq("teamId", franchise.userTeamId),
    )
    .take(MAX_ROSTER);
  return [...new Set(entries.filter((e) => ON_THE_TEAM.has(e.status)).map((e) => e.playerId))];
}

/** The team's streaks, and every run of three or more by someone on the roster, longest first. */
export const running = query({
  args: {},
  returns: v.object({
    team: v.array(vStreak),
    players: v.array(v.object({ ...vStreak.fields, player: vHolder })),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const rostered = await rosteredPlayers(ctx, franchise);
    const players = await playersById(ctx, rostered);
    const rows = await Promise.all(
      rostered.map((playerId) =>
        ctx.db
          .query("streaks")
          .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
          .take(MAX_PER_HOLDER),
      ),
    );
    return {
      team: (await teamRows(ctx, franchise._id)).map(view),
      players: rows
        .flat()
        .flatMap((r) => {
          const p = r.playerId ? players.get(r.playerId) : undefined;
          return p && r.current >= MIN_ACTIVE_STREAK ? [{ ...view(r), player: holderOf(p) }] : [];
        })
        .sort((a, b) => b.current - a.current || kindOrder(a.key) - kindOrder(b.key)),
    };
  },
});

type Run = { key: string; longest: number; span: string | null };
type PlayerRun = Run & { playerId: Id<"players"> };

const TEAM_KINDS = [...TEAM_STREAKS, ...SEASON_STREAKS];

const byKind = (a: Run, b: Run) =>
  TEAM_KINDS.findIndex((k) => k.key === a.key) - TEAM_KINDS.findIndex((k) => k.key === b.key);

/** Every kind's best runs ever: one read per kind, off the franchise's index. */
async function longestEver(ctx: QueryCtx, franchiseId: Id<"franchises">) {
  const team: Run[] = (await teamRows(ctx, franchiseId)).map(view);
  const lists = await Promise.all(
    PLAYER_STREAKS.map(({ key }) =>
      ctx.db
        .query("streaks")
        .withIndex("by_franchiseId_and_key_and_longest", (q) =>
          q.eq("franchiseId", franchiseId).eq("key", key),
        )
        .order("desc")
        // One more than a list shows, for the team row sharing the key.
        .take(STREAK_LIST_SIZE + 1),
    ),
  );
  const players: PlayerRun[] = lists
    .flat()
    .flatMap((r) => (r.playerId ? [{ ...view(r), playerId: r.playerId }] : []));
  return { team, players };
}

/** The same lists worked out from one season's games, since streak rows hold only the career's. */
async function longestIn(ctx: QueryCtx, franchise: Doc<"franchises">, season: Doc<"seasons">) {
  const games = await orderedSeasonGames(ctx, season);
  const team: Run[] = teamStreaks(await teamGames(ctx, franchise, games)).map((r) => ({
    key: r.key,
    longest: r.longest,
    span: streakSpanLabel(r.longestFrom, r.longestTo),
  }));
  const careers = new Map<Id<"players">, Parameters<typeof playerStreaks<Id<"seasons">>>[0][number][]>();
  for (const game of games) {
    const lines = await ctx.db
      .query("gameStatLines")
      .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id).eq("teamId", franchise.userTeamId))
      .take(MAX_GAME_LINES);
    for (const line of lines) {
      if (!line.playerId) continue;
      const entry = {
        at: { seasonId: season._id, year: season.year, weekKey: game.weekKey },
        line: line.stats as StatLine,
      };
      careers.set(line.playerId, [...(careers.get(line.playerId) ?? []), entry]);
    }
  }
  const players: PlayerRun[] = [...careers].flatMap(([playerId, played]) =>
    playerStreaks(played).map((r) => ({
      key: r.key,
      longest: r.longest,
      span: streakSpanLabel(r.longestFrom, r.longestTo),
      playerId,
    })),
  );
  return { team, players };
}

const vTeamRun = v.object({ key: v.string(), longest: v.number(), span: nullable(v.string()) });

/** Longest runs per kind: of all time, or within one season. */
export const longest = query({
  args: { seasonId: v.optional(v.id("seasons")) },
  returns: v.object({
    team: v.array(vTeamRun),
    players: v.array(
      v.object({
        key: v.string(),
        entries: v.array(
          v.object({ rank: v.number(), longest: v.number(), span: nullable(v.string()), player: vHolder }),
        ),
      }),
    ),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = seasonId ? must(await ctx.db.get("seasons", seasonId), "Season") : null;
    const { team, players } = season
      ? await longestIn(ctx, franchise, season)
      : await longestEver(ctx, franchise._id);
    const lists = rankRuns(players, PLAYER_STREAKS);
    const names = await playersById(
      ctx,
      lists.flatMap((l) => l.entries.map((e) => e.playerId)),
    );
    return {
      team: team.sort(byKind).map(({ key, longest: length, span }) => ({ key, longest: length, span })),
      players: lists.map(({ key, entries }) => ({
        key,
        entries: entries.flatMap((e) => {
          const p = names.get(e.playerId);
          return p ? [{ rank: e.rank, longest: e.longest, span: e.span, player: holderOf(p) }] : [];
        }),
      })),
    };
  },
});

export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.array(vStreak),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const rows = await ctx.db
      .query("streaks")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(MAX_PER_HOLDER);
    return rows.map(view);
  },
});

/** The team's record lists (`shared/stats/teamRecords.ts`): reading them, and rewriting a season's. */
import { v } from "convex/values";
import { weekPhase } from "../../shared/domain";
import { userScore } from "../../shared/games/summary";
import {
  mergeTeamEntries,
  TEAM_RECORD_SCOPES,
  TEAM_RECORD_STAT_KEYS,
  teamSeasonEntries,
  type TeamGameFacts,
  type TeamRecordStat,
  type TeamStatLine,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { gamePlays } from "../games/playRows";
import { requireOwner } from "../lib/auth";
import { activeFranchise, teamsById } from "../lib/franchise";
import { toTeamRef, vTeamRef } from "../lib/refs";
import { seasonGames } from "../lib/reports";
import { vStatSplit, vTeamRecordScope, vWeekKey } from "../lib/validators";

const nullable = <T extends Parameters<typeof v.union>[0]>(validator: T) => v.union(validator, v.null());

/** Every list of one scope, top twenty. */
const LIST_SIZE = 20;
const SPLITS = ["regular", "postseason"] as const;

type Split = (typeof SPLITS)[number];

/** A season's played games as team records read them, one split at a time. */
export async function teamGameFacts(ctx: QueryCtx, franchise: Doc<"franchises">, season: Doc<"seasons">) {
  const games = await seasonGames(ctx, season._id);
  const facts = await Promise.all(
    games.map(async (game) => {
      const score = userScore(game);
      const phase = weekPhase(game.weekKey);
      if (!score || (phase !== "regular" && phase !== "postseason")) return null;
      const sides = await ctx.db
        .query("gameTeamStats")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id))
        .take(2);
      const line = (own: boolean) => {
        const row = sides.find((s) => (s.teamId === franchise.userTeamId) === own);
        return row ? (row.stats as TeamStatLine) : null;
      };
      const row: TeamGameFacts<Id<"games">, Id<"seasons">, Id<"teams">> & {
        split: Split;
        overtime: boolean;
      } = {
        split: phase,
        overtime: game.overtime ?? false,
        gameId: game._id,
        seasonId: season._id,
        year: season.year,
        weekKey: game.weekKey,
        opponentTeamId: game.opponentTeamId ?? null,
        userIsHome: game.userIsHome ?? true,
        us: score.us,
        them: score.them,
        won: score.us > score.them,
        own: line(true),
        opponent: line(false),
        lineScore: game.lineScore ?? null,
        plays: await gamePlays(ctx, game._id),
      };
      return row;
    }),
  );
  return facts.filter((f) => f !== null);
}

const allTeamLists = () =>
  TEAM_RECORD_STAT_KEYS.flatMap((statKey) =>
    TEAM_RECORD_SCOPES.map((scope) => ({ statKey, scope, entries: [] })),
  );

export type TeamRecordBroken = { statKey: TeamRecordStat; split: Split; value: number; gameId: Id<"games"> };

/** Rewrites one season's entries on every list. Returns the single-game records a game just took. */
export async function writeTeamRecords(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  season: Doc<"seasons">,
): Promise<TeamRecordBroken[]> {
  const facts = await teamGameFacts(ctx, franchise, season);
  const broken: TeamRecordBroken[] = [];
  for (const split of SPLITS) {
    const lists = teamSeasonEntries(facts.filter((f) => f.split === split));
    // A season left with no games still has to come off every list.
    const every = lists.length > 0 ? lists : allTeamLists();
    for (const { statKey, scope, entries } of every) {
      const board = await ctx.db
        .query("teamRecords")
        .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) =>
          q.eq("franchiseId", franchise._id).eq("split", split).eq("scope", scope).eq("statKey", statKey),
        )
        .unique();
      const top = mergeTeamEntries(statKey, board?.top ?? [], season._id, entries);
      if (board && JSON.stringify(board.top) === JSON.stringify(top)) continue;
      if (board && top.length === 0) await ctx.db.delete("teamRecords", board._id);
      else if (board) await ctx.db.patch("teamRecords", board._id, { top });
      else if (top.length > 0) {
        await ctx.db.insert("teamRecords", { franchiseId: franchise._id, split, scope, statKey, top });
      }
      const was = board?.top[0];
      const now = top[0];
      // The first entry on a list sets nothing to beat.
      if (scope === "game" && was && now?.gameId && now.gameId !== was.gameId && now.value !== was.value) {
        broken.push({ statKey, split, value: now.value, gameId: now.gameId });
      }
    }
  }
  return broken;
}

export const lists = query({
  args: { split: vStatSplit, scope: vTeamRecordScope },
  returns: v.array(
    v.object({
      statKey: v.string(),
      entries: v.array(
        v.object({
          rank: v.number(),
          value: v.number(),
          year: v.number(),
          gameId: nullable(v.id("games")),
          weekKey: nullable(vWeekKey),
          opponent: nullable(vTeamRef),
          period: nullable(v.number()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { split, scope }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const boards = await ctx.db
      .query("teamRecords")
      .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) =>
        q.eq("franchiseId", franchise._id).eq("split", split).eq("scope", scope),
      )
      .take(TEAM_RECORD_STAT_KEYS.length);
    const teams = await teamsById(ctx);
    const order = (key: string) => TEAM_RECORD_STAT_KEYS.indexOf(key as TeamRecordStat);
    return boards
      .sort((a, b) => order(a.statKey) - order(b.statKey))
      .map((board) => ({
        statKey: board.statKey,
        entries: board.top.slice(0, LIST_SIZE).map((e, i) => {
          const opponent = e.opponentTeamId ? teams.get(e.opponentTeamId) : undefined;
          return {
            rank: i + 1,
            value: e.value,
            year: e.year,
            gameId: e.gameId ?? null,
            weekKey: e.weekKey ?? null,
            opponent: opponent ? toTeamRef(opponent) : null,
            period: e.period ?? null,
          };
        }),
      }));
  },
});

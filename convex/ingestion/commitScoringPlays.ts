/**
 * Commits a game's scoring summary as a set: the plays replace what the game had, the quarter
 * scores follow from them, and a game with no final yet takes its score from the last play.
 * A name that matched no player stays as printed; the game page asks for it.
 */
import { resolvePasser } from "../../shared/games/scorers";
import { compareRows, parsePlay, type ParsedPlay } from "../../shared/ingestion/rows/scoringSpec";
import { lineScoreFromPlays } from "../../shared/stats/scoring";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { deleteScoringPlays, gamePlays } from "../games/playRows";
import { invalid, must } from "../lib/errors";
import { rowGameContext } from "../lib/gameContext";
import { findGame, refreshSeasonRecord, upsertGame } from "./commitGame";
import { textOf, type RowCommit, type RowCommitResult, type StoredRow } from "./rowCommit";
import { playerFor } from "./rowPlayers";

const samePlay = (a: Pick<ParsedPlay, "period" | "clock">, b: Pick<ParsedPlay, "period" | "clock">) =>
  a.period === b.period && a.clock === b.clock;

/** The row's player: the one review chose, else whoever had this play before a re-read. */
async function scorerOf(
  ctx: MutationCtx,
  commit: RowCommit,
  row: StoredRow,
  previous: Doc<"scoringPlays"> | undefined,
): Promise<Id<"players"> | undefined> {
  if (!row.playerId) return row.name && row.name !== previous?.rawName ? undefined : previous?.playerId;
  if (!row.name) {
    const player = must(await ctx.db.get("players", row.playerId), "Player");
    if (player.franchiseId !== commit.franchise._id) throw invalid("Player must belong to this franchise");
    return player._id;
  }
  const player = await playerFor(ctx, commit.franchise._id, {
    name: row.name,
    playerId: row.playerId,
    position: null,
    seasonId: commit.season._id,
    teamAbbr: row.teamAbbr ?? undefined,
  });
  return player._id;
}

export async function commitScoringPlays(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const { franchise, season, weekKey, gameId } = commit;
  const found = await findGame(ctx, { gameId, seasonId: season._id, weekKey });
  const game = must(found, "Game");
  const context = must(await rowGameContext(ctx, game._id), "Game");
  const { homeTeamId, awayTeamId } = game;
  if (!homeTeamId || !awayTeamId) throw invalid("That game has no teams yet");

  const previous = await gamePlays(ctx, game._id);
  const rows = [...commit.rows].sort(compareRows);
  const plays: (ParsedPlay & { row: StoredRow; teamId: Id<"teams"> })[] = rows.map((row) => ({
    ...must(parsePlay(row), "Scoring play"),
    row,
    teamId: row.teamAbbr === context.homeAbbr ? homeTeamId : awayTeamId,
  }));

  await deleteScoringPlays(ctx, game._id);
  for (const [i, { row, ...play }] of plays.entries()) {
    const before = previous.find((p) => samePlay(p, play) && p.teamId === play.teamId);
    const passerName = textOf(row, "passer");
    await ctx.db.insert("scoringPlays", {
      franchiseId: franchise._id,
      seasonId: game.seasonId,
      gameId: game._id,
      order: i + 1,
      ...play,
      playerId: await scorerOf(ctx, commit, row, before),
      rawName: row.name ?? undefined,
      ...(play.kind === "pass_td"
        ? {
            passerId: resolvePasser(passerName ?? null, row.teamAbbr, context.lines) ?? before?.passerId,
            passerName,
          }
        : {}),
      description: textOf(row, "description"),
    });
  }

  const last = plays.at(-1);
  const line = lineScoreFromPlays(plays);
  const overtime = line.home.length > 4;
  if (last && game.homeScore === undefined) {
    await upsertGame(
      ctx,
      franchise,
      { gameId: game._id },
      {
        homeAbbr: context.homeAbbr,
        awayAbbr: context.awayAbbr,
        homeScore: last.homeScore,
        awayScore: last.awayScore,
        overtime,
        lineScore: line,
      },
    );
    await refreshSeasonRecord(ctx, game.seasonId);
    await ctx.scheduler.runAfter(0, internal.stats.refresh.afterGame, { gameId: game._id, playerIds: [] });
  } else if (last) {
    await ctx.db.patch("games", game._id, { lineScore: line, overtime });
  }
  await ctx.scheduler.runAfter(0, internal.stats.scoring.afterPlays, { gameId: game._id });
  return { gameId: game._id };
}

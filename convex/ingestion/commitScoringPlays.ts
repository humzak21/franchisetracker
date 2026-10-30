/**
 * Commits a game's scoring summary as a set: the plays replace what the game had, the quarter
 * scores follow from them, and a game with no final yet takes its score from the last play.
 * A name that matched no player stays as printed; the game page asks for it.
 */
import { matchLine, resolvePasser, type GameLine } from "../../shared/games/scorers";
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

/**
 * The row's player: the one review chose, else the box score line the printed name settles on
 * (a player a game log's own box score just added has no id until commit), else whoever had this
 * play before a re-read.
 */
async function scorerOf(
  ctx: MutationCtx,
  game: Doc<"games">,
  row: StoredRow,
  lines: readonly GameLine<Id<"players">>[],
  previous: Doc<"scoringPlays"> | undefined,
): Promise<Id<"players"> | undefined> {
  if (!row.playerId) {
    const line = row.name ? matchLine(row.name, row.teamAbbr, lines) : null;
    if (line) return line;
    return row.name && row.name !== previous?.rawName ? undefined : previous?.playerId;
  }
  if (!row.name) {
    const player = must(await ctx.db.get("players", row.playerId), "Player");
    if (player.franchiseId !== game.franchiseId) throw invalid("Player must belong to this franchise");
    return player._id;
  }
  const player = await playerFor(ctx, game.franchiseId, {
    name: row.name,
    playerId: row.playerId,
    position: null,
    seasonId: game.seasonId,
    teamAbbr: row.teamAbbr ?? undefined,
  });
  return player._id;
}

export async function commitScoringPlays(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const { franchise, season, weekKey, gameId } = commit;
  const found = await findGame(ctx, { gameId, seasonId: season._id, weekKey });
  const game = must(found, "Game");
  await commitPlays(ctx, franchise, game, commit.rows);
  return { gameId: game._id };
}

/** Writes accepted rows as the game's plays. No rows leaves what the game has alone. */
export async function commitPlays(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  game: Doc<"games">,
  accepted: readonly StoredRow[],
): Promise<void> {
  if (accepted.length === 0) return;
  const context = must(await rowGameContext(ctx, game._id), "Game");
  const { homeTeamId, awayTeamId } = game;
  if (!homeTeamId || !awayTeamId) throw invalid("That game has no teams yet");

  const previous = await gamePlays(ctx, game._id);
  const rows = [...accepted].sort(compareRows);
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
      playerId: await scorerOf(ctx, game, row, context.lines, before),
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
}

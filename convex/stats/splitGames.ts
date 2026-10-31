/** Games as splits read them (`shared/stats/splits.ts`). */
import { userScore } from "../../shared/games/summary";
import { splitGameOf, type SplitGame } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type TeamsById = ReadonlyMap<Id<"teams">, Doc<"teams">>;

/** A played game's split facts; null for a game with no final score or no opponent. */
export function splitFacts(game: Doc<"games">, userTeamId: Id<"teams">, teams: TeamsById): SplitGame | null {
  const score = userScore(game);
  const own = teams.get(userTeamId);
  const opponent = game.opponentTeamId ? teams.get(game.opponentTeamId) : undefined;
  if (!score || !own || !opponent) return null;
  return splitGameOf({
    gameId: game._id,
    weekKey: game.weekKey,
    userIsHome: game.userIsHome ?? true,
    us: score.us,
    them: score.them,
    overtime: game.overtime ?? false,
    lineScore: game.lineScore ?? null,
    own,
    opponent,
  });
}

/** One read per distinct game: a career's lines, at most a few hundred. */
export async function splitGamesOf(
  ctx: QueryCtx,
  lines: readonly { gameId: Id<"games"> }[],
  userTeamId: Id<"teams">,
  teams: TeamsById,
) {
  const docs = await Promise.all(
    [...new Set(lines.map((l) => l.gameId))].map((id) => ctx.db.get("games", id)),
  );
  return docs.flatMap((game) => {
    const facts = game && splitFacts(game, userTeamId, teams);
    return facts ? [facts] : [];
  });
}

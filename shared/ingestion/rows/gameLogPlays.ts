/** A full game log's scoring plays: the game they are checked against, and their warnings. */
import type { DraftWarning, GameLogDraft } from "../types";
import { validateRows } from "./engine";
import { NEW_LINE, scoringPlaysSpec } from "./scoringSpec";
import type { RowGameContext } from "./types";

/**
 * The game a full game log's plays are checked against: the log's own header and box score, or
 * the game's stored box score when the upload had no player screens. Null without both teams.
 */
export function gameLogContext<P extends string>(
  draft: GameLogDraft<P>,
  stored: RowGameContext<P> | null | undefined,
): RowGameContext<string> | null {
  const { homeAbbr, awayAbbr, homeScore, awayScore } = draft.game;
  if (!homeAbbr || !awayAbbr) return null;
  const lines =
    draft.lines.length > 0
      ? draft.lines.flatMap((l) =>
          l.teamAbbr
            ? [
                {
                  playerId: l.playerId ?? `${NEW_LINE}${l.id}`,
                  name: l.name,
                  teamAbbr: l.teamAbbr,
                  stats: l.stats,
                },
              ]
            : [],
        )
      : (stored?.lines ?? []);
  return { homeAbbr, awayAbbr, homeScore, awayScore, lines };
}

/** The spec writes paths under `rows.`; a game log keeps the same rows under `plays.`. */
export const toPlaysPath = (path: string) =>
  path.startsWith("rows.") ? `plays.${path.slice("rows.".length)}` : path;

/** The full game log's plays, checked like a scoring summary. Nothing accepted, nothing to check. */
export function gameLogPlayWarnings<P extends string>(
  draft: GameLogDraft<P>,
  stored: RowGameContext<P> | null | undefined,
): DraftWarning[] {
  const rows = draft.plays ?? [];
  const game = gameLogContext(draft, stored);
  if (!game || !rows.some((r) => r.accepted)) return [];
  return validateRows(scoringPlaysSpec, { target: "scoring_plays", meta: {}, rows }, game).map((w) =>
    w.path ? { ...w, path: toPlaysPath(w.path) } : w,
  );
}

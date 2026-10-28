/**
 * Every scored game of a season by team abbreviation, for tiebreakers and the bracket: league
 * games from the schedule screen plus the user team's own games, which win where both have the
 * same game (their box score is the more trusted score).
 */
import { isPlayoffRound, weekPhase } from "../../shared/domain";
import type { PlayoffScore } from "../../shared/league/standings";
import type { FinalScore } from "../../shared/league/tiebreakers";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { seasonGames } from "./reports";

/** A full season of league games with the playoffs, with headroom. */
const MAX_LEAGUE_GAMES = 400;

export type SeasonScores = { regular: FinalScore[]; playoffs: PlayoffScore[] };

export async function seasonScores(
  ctx: QueryCtx,
  seasonId: Id<"seasons">,
  teams: ReadonlyMap<Id<"teams">, Doc<"teams">>,
): Promise<SeasonScores> {
  const [league, own] = await Promise.all([
    ctx.db
      .query("leagueGames")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_LEAGUE_GAMES),
    seasonGames(ctx, seasonId),
  ]);
  const unique = new Map<
    string,
    { weekKey: Doc<"games">["weekKey"]; home: string; away: string; homeScore: number; awayScore: number }
  >();
  for (const g of [...league, ...own]) {
    const home = g.homeTeamId && teams.get(g.homeTeamId)?.abbr;
    const away = g.awayTeamId && teams.get(g.awayTeamId)?.abbr;
    if (!home || !away || typeof g.homeScore !== "number" || typeof g.awayScore !== "number") continue;
    const key = `${g.weekKey}|${[home, away].sort().join("|")}`;
    unique.set(key, { weekKey: g.weekKey, home, away, homeScore: g.homeScore, awayScore: g.awayScore });
  }
  const out: SeasonScores = { regular: [], playoffs: [] };
  for (const { weekKey, ...game } of unique.values()) {
    if (weekPhase(weekKey) === "regular") out.regular.push(game);
    else if (isPlayoffRound(weekKey)) out.playoffs.push({ round: weekKey, ...game });
  }
  return out;
}

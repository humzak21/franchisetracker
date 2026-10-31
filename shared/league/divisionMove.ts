/**
 * How a week moved a team in its division (FEATURES.md 5.1). Standings have no week, so both
 * places are worked out from league scores, and a division whose scores were not captured has none. Pure.
 */
import type { Conference } from "../domain/teams";
import { weekIndex, weekPhase, type WeekKey } from "../domain/calendar";
import type { StandingDivision } from "./alignment";
import { gamesIn, recordsFromGames } from "./records";
import { tiebreaker, type FinalScore } from "./tiebreakers";

export type WeekScore = FinalScore & { weekKey: WeekKey };
export type DivisionTeam = { teamAbbr: string; conference: Conference; division: StandingDivision };
export type DivisionMove = { rank: number; previous: number };

function placesThrough(members: readonly DivisionTeam[], games: readonly WeekScore[], week: number) {
  const scored = games.filter((g) => weekPhase(g.weekKey) === "regular" && weekIndex(g.weekKey) <= week);
  const records = recordsFromGames(
    scored.map((g) => ({
      weekKey: g.weekKey,
      homeTeamId: g.home,
      awayTeamId: g.away,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
    })),
  );
  const rows = members.map((m) => ({
    ...m,
    w: 0,
    l: 0,
    t: 0,
    ...records.get(m.teamAbbr),
  }));
  return { rows, order: tiebreaker(rows, scored).division(members.map((m) => m.teamAbbr)) };
}

/** Null for a playoff week, or when a rival is short of games: a bye costs one, a gap in the scores more. */
export function divisionMove(
  teamAbbr: string,
  members: readonly DivisionTeam[],
  games: readonly WeekScore[],
  weekKey: WeekKey,
): DivisionMove | null {
  if (weekPhase(weekKey) !== "regular") return null;
  const week = weekIndex(weekKey);
  const now = placesThrough(members, games, week);
  const own = now.rows.find((r) => r.teamAbbr === teamAbbr);
  if (!own || now.rows.some((r) => gamesIn(r) < gamesIn(own) - 1)) return null;
  return {
    rank: now.order.indexOf(teamAbbr) + 1,
    previous: placesThrough(members, games, week - 1).order.indexOf(teamAbbr) + 1,
  };
}

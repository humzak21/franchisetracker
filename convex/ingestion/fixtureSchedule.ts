/**
 * The canned league schedule screen: the user's game that week (so committing it confirms the
 * user's own score) and a few other games, printed as Madden prints them: nicknames in the
 * matchup, away first.
 */
import { resolveTeamAbbr } from "../../shared/domain/teams";

const sure = { confidence: 0.95, unclear_fields: [] as string[] };

const OTHER_GAMES = [
  { away_team: "49ers", home_team: "Chargers", away_score: 23, home_score: 20, time: "Thu 8:15 PM" },
  { away_team: "Seahawks", home_team: "Eagles", away_score: 42, home_score: 21, time: "Sat 5:00 PM" },
  { away_team: "Colts", home_team: "Titans", away_score: 44, home_score: 22, time: "Sun 1:00 PM" },
  { away_team: "Saints", home_team: "Buccaneers", away_score: 16, home_score: 26, time: "Sun 1:00 PM" },
  { away_team: "Jaguars", home_team: "Texans", away_score: 28, home_score: 49, time: "Sun 1:00 PM" },
];

/** The user's game scores as the box score fixture does: the user wins 31 to 17. */
export function fixtureSchedule(game: {
  home: string;
  away: string;
  userIsHome: boolean;
}): Record<string, unknown> {
  const busy = new Set([game.home, game.away]);
  const others = OTHER_GAMES.filter(
    (g) => !busy.has(resolveTeamAbbr(g.away_team) ?? "") && !busy.has(resolveTeamAbbr(g.home_team) ?? ""),
  );
  return {
    week: null,
    rows: [
      {
        away_team: game.away,
        home_team: game.home,
        away_score: game.userIsHome ? 17 : 31,
        home_score: game.userIsHome ? 31 : 17,
        time: "Sun 1:00 PM",
        ...sure,
      },
      ...others.map((g) => ({ ...g, ...sure })),
    ],
  };
}

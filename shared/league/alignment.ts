/**
 * Which conference and division a team played in a given season. Today's eight divisions came
 * with the 2002 realignment; real NFL seasons before it (imported from 1999, docs/NFL-HISTORY.md)
 * had six, so standings and brackets of those years read the era's alignment, not the team's.
 */
import { NFL_TEAMS, type Conference, type Division } from "../domain/teams";

/** Divisions a standings table can show, in display order: today's four plus the old Central. */
export const STANDING_DIVISIONS = ["East", "North", "Central", "South", "West"] as const;
export type StandingDivision = (typeof STANDING_DIVISIONS)[number];

export type Alignment = { conference: Conference; division: StandingDivision };

/** The first season of today's 32 teams and eight divisions. */
export const REALIGNMENT_YEAR = 2002;

/** The first season of the six-division alignment below as modelled: the Browns returned in 1999. */
const SIX_DIVISION_FIRST_YEAR = 1999;

/**
 * 1999–2001, in today's abbreviations (Oakland is LV, San Diego LAC, St. Louis LAR). Verified
 * against nflverse: every pair listed together met twice a season as division games.
 */
// One division per line reads as a table; keep it that way.
// prettier-ignore
const SIX_DIVISIONS: readonly (readonly [Conference, StandingDivision, readonly string[]])[] = [
  ["AFC", "East", ["BUF", "IND", "MIA", "NE", "NYJ"]],
  ["AFC", "Central", ["BAL", "CIN", "CLE", "JAX", "PIT", "TEN"]],
  ["AFC", "West", ["DEN", "KC", "LV", "LAC", "SEA"]],
  ["NFC", "East", ["ARI", "DAL", "NYG", "PHI", "WAS"]],
  ["NFC", "Central", ["CHI", "DET", "GB", "MIN", "TB"]],
  ["NFC", "West", ["ATL", "CAR", "NO", "SF", "LAR"]],
];

const SIX_DIVISION_ALIGNMENT = new Map<string, Alignment>(
  SIX_DIVISIONS.flatMap(([conference, division, teams]) =>
    teams.map((abbr) => [abbr, { conference, division }] as const),
  ),
);

const usesSixDivisions = (year: number) => year >= SIX_DIVISION_FIRST_YEAR && year < REALIGNMENT_YEAR;

/**
 * A team's conference and division in a season. Seasons before 1999 are not modelled and read
 * today's alignment, like every season since 2002.
 */
export function alignmentFor(
  year: number,
  team: { abbr: string; conference: Conference; division: Division },
): Alignment {
  const old = usesSixDivisions(year) ? SIX_DIVISION_ALIGNMENT.get(team.abbr) : undefined;
  return old ?? { conference: team.conference, division: team.division };
}

/** Every team in the league that season with its alignment (31 before Houston joined in 2002). */
export function leagueAlignment(year: number): Map<string, Alignment> {
  if (usesSixDivisions(year)) return SIX_DIVISION_ALIGNMENT;
  return new Map(NFL_TEAMS.map((t) => [t.abbr, { conference: t.conference, division: t.division }]));
}

/** Playoff teams per conference that skip the wild card round: two in 1990–2019, one since 2020. */
export function playoffByes(year: number): number {
  return year >= 2020 ? 1 : 2;
}

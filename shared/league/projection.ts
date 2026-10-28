/**
 * A season's standings as they stand (FEATURES.md 5.6): division ranks, the playoff seeds if the
 * season ended today, and who has clinched what. Once every team has played its regular season
 * the seeds lock; seeds and ranks printed on a standings screen (or imported) win over ours
 * then, since Madden breaks ties we do not model. Pure.
 */
import type { PlayoffResult } from "../domain/calendar";
import { CONFERENCES } from "../domain/teams";
import { playoffByes } from "./alignment";
import { buildBracket, playoffResultsOf, type PlayoffScore, type StandingRow } from "./standings";
import { tiebreaker, type FinalScore, type TiebreakTeam } from "./tiebreakers";

/** z: clinched a first-round bye, y: the division, x: a playoff spot. Each implies the next. */
export type Clinch = "z" | "y" | "x";

export const CLINCH_LABELS: Record<Clinch, string> = {
  z: "Clinched a first-round bye",
  y: "Clinched the division",
  x: "Clinched a playoff spot",
};

/** Regular-season games per team: seventeen since 2021, sixteen from 1978. */
export const regularSeasonLength = (year: number) => (year >= 2021 ? 17 : 16);

/** Playoff teams per conference: seven since 2020, six from 1990. */
export const playoffTeams = (year: number) => (year >= 2020 ? 7 : 6);

export type ProjectionInput = TiebreakTeam & { divisionRank?: number; seed?: number };

export type Projected = {
  teamAbbr: string;
  divisionRank: number;
  /** Order in the conference: the seeds first, then everyone else. */
  conferenceRank: number;
  seed: number | null;
  clinch: Clinch | null;
};

export type Projection = {
  /** Every team has played its regular season (or the seeds are on file): the bracket is set. */
  final: boolean;
  byeSeeds: number;
  rows: Map<string, Projected>;
};

const played = (r: { w: number; l: number; t: number }) => r.w + r.l + r.t;

/** Seeds printed or imported for a whole field: every conference has all its playoff teams. */
function seedsOnFile(rows: readonly ProjectionInput[], seeds: number) {
  return CONFERENCES.every(
    (c) => rows.filter((r) => r.conference === c && r.seed !== undefined).length >= seeds,
  );
}

/**
 * Clinches by arithmetic alone: a team has clinched against everyone who cannot reach its record
 * even by winning out while it loses out. Ties go against the team, so a mark is never wrong,
 * only sometimes a week late.
 */
function clinches(rows: readonly ProjectionInput[], year: number): Map<string, Clinch> {
  const length = regularSeasonLength(year);
  const seeds = playoffTeams(year);
  const byes = playoffByes(year);
  const floor = (r: ProjectionInput) => 2 * r.w + r.t;
  const ceiling = (r: ProjectionInput) => 2 * (r.w + Math.max(0, length - played(r))) + r.t;
  const out = new Map<string, Clinch>();
  for (const team of rows) {
    const conference = rows.filter((r) => r.conference === team.conference && r.teamAbbr !== team.teamAbbr);
    const divisions = new Map<string, number>();
    for (const r of conference) {
      const threat = ceiling(r) >= floor(team) ? 1 : 0;
      divisions.set(r.division, (divisions.get(r.division) ?? 0) + threat);
    }
    const own = divisions.get(team.division) ?? 0;
    const others = [...divisions].filter(([d]) => d !== team.division);
    const division = own === 0;
    // Every other division sends its winner, ahead of us or not, plus anyone who can pass us.
    const ahead = own + others.reduce((sum, [, threats]) => sum + Math.max(threats, 1), 0);
    const bye = division && others.filter(([, threats]) => threats > 0).length < byes;
    if (bye) out.set(team.teamAbbr, "z");
    else if (division) out.set(team.teamAbbr, "y");
    else if (ahead < seeds) out.set(team.teamAbbr, "x");
  }
  return out;
}

/** The marks a finished field earned: a bye seed, a division title, or any other seed. */
function finalClinch(p: Pick<Projected, "seed" | "divisionRank">, byes: number): Clinch | null {
  if (p.seed === null) return null;
  if (p.seed <= byes) return "z";
  return p.divisionRank === 1 ? "y" : "x";
}

export function projectStandings(
  year: number,
  rows: readonly ProjectionInput[],
  games: readonly FinalScore[],
): Projection {
  const seeds = playoffTeams(year);
  const byes = playoffByes(year);
  const length = regularSeasonLength(year);
  const onFile = seedsOnFile(rows, seeds);
  const final = onFile || (rows.length >= 2 * seeds && rows.every((r) => played(r) >= length));
  const rank = tiebreaker(rows, games);
  const out = new Map<string, Projected>();

  for (const conference of CONFERENCES) {
    const teams = rows.filter((r) => r.conference === conference);
    if (teams.length === 0) continue;
    const divisionRank = new Map<string, number>();
    for (const division of new Set(teams.map((t) => t.division))) {
      const members = teams.filter((t) => t.division === division);
      const printed = onFile && members.every((m) => m.divisionRank !== undefined);
      const ordered = printed
        ? [...members].sort((a, b) => a.divisionRank! - b.divisionRank!).map((t) => t.teamAbbr)
        : rank.division(members.map((t) => t.teamAbbr));
      ordered.forEach((t, i) => divisionRank.set(t, i + 1));
    }
    const rankOf = (t: string) => divisionRank.get(t) ?? 9;
    let ordered: string[];
    if (onFile) {
      const seeded = teams.filter((t) => t.seed !== undefined).sort((a, b) => a.seed! - b.seed!);
      const rest = rank.conference(
        teams.filter((t) => t.seed === undefined).map((t) => t.teamAbbr),
        rankOf,
      );
      ordered = [...seeded.map((t) => t.teamAbbr), ...rest];
    } else {
      const winners = rank.conference(
        teams.filter((t) => rankOf(t.teamAbbr) === 1).map((t) => t.teamAbbr),
        rankOf,
      );
      const rest = rank.conference(
        teams.filter((t) => rankOf(t.teamAbbr) !== 1).map((t) => t.teamAbbr),
        rankOf,
      );
      ordered = [...winners, ...rest];
    }
    ordered.forEach((teamAbbr, i) =>
      out.set(teamAbbr, {
        teamAbbr,
        divisionRank: rankOf(teamAbbr),
        conferenceRank: i + 1,
        seed: i < seeds ? i + 1 : null,
        clinch: null,
      }),
    );
  }

  const marks = final ? null : clinches(rows, year);
  for (const p of out.values()) p.clinch = marks ? (marks.get(p.teamAbbr) ?? null) : finalClinch(p, byes);
  return { final, byeSeeds: byes, rows: out };
}

/**
 * The whole board for a season: the projection, the bracket (projected seeds with no results
 * until the field is set, then the real one decided by scores and stored results) and where
 * each finished run ended.
 */
export function seasonBoard<T extends StandingRow>(
  year: number,
  rows: readonly T[],
  scores: { regular: readonly FinalScore[]; playoffs: readonly PlayoffScore[] },
) {
  const projection = projectStandings(year, rows, scores.regular);
  const field = rows.map((r) => ({
    ...r,
    seed: projection.rows.get(r.teamAbbr)?.seed ?? undefined,
    playoffResult: projection.final ? r.playoffResult : undefined,
  }));
  const bracket = buildBracket(field, projection.final ? scores.playoffs : []);
  const results: Map<string, PlayoffResult> = projection.final ? playoffResultsOf(bracket) : new Map();
  return { projection, bracket, results };
}

/**
 * League tables (FEATURES.md 5.6): division standings, the playoff bracket rebuilt from seeds and
 * where each team's run ended, conference and league champions, and the all-time table. Pure.
 */
import { CONFERENCES, DIVISIONS, type Conference, type Division } from "../domain/teams";
import { PLAYOFF_ROUNDS, type PlayoffResult, type PlayoffRound } from "../domain/calendar";
import { winPct } from "../stats/format";

export type StandingRow = {
  teamAbbr: string;
  conference: Conference;
  division: Division;
  w: number;
  l: number;
  t: number;
  divisionRank?: number;
  seed?: number;
  playoffResult?: PlayoffResult;
  pointsFor?: number;
  pointsAgainst?: number;
};

const pct = (r: { w: number; l: number; t: number }) => winPct(r) ?? 0;

/** One division in finishing order: the printed rank, else win percentage. */
export function sortDivision<T extends StandingRow>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      (a.divisionRank ?? 9) - (b.divisionRank ?? 9) ||
      pct(b) - pct(a) ||
      a.teamAbbr.localeCompare(b.teamAbbr),
  );
}

/** Standings by conference then division, each division in finishing order. */
export function groupStandings<T extends StandingRow>(rows: readonly T[]) {
  return CONFERENCES.map((conference) => ({
    conference,
    divisions: DIVISIONS.map((division) => ({
      division,
      rows: sortDivision(rows.filter((r) => r.conference === conference && r.division === division)),
    })).filter((d) => d.rows.length > 0),
  })).filter((c) => c.divisions.length > 0);
}

/** How many playoff rounds a team won: −1 out of the playoffs, 4 the title. */
const ROUNDS_WON: Record<PlayoffResult, number> = {
  missed: -1,
  wc_loss: 0,
  div_loss: 1,
  conf_loss: 2,
  sb_loss: 3,
  champion: 4,
};

export type BracketTeam = { teamAbbr: string; seed: number };
export type BracketGame = {
  round: PlayoffRound;
  conference: Conference | null;
  /** The higher seed hosts (the Super Bowl lists the AFC first). */
  home: BracketTeam;
  away: BracketTeam;
  winner: string | null;
};

/** Pairs a seed-ordered list outside in: 1 vs 4, 2 vs 3. */
function outsideIn<T>(list: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < list.length / 2; i++) out.push([list[i]!, list[list.length - 1 - i]!]);
  return out;
}

/**
 * The playoff bracket from seeds and results: wild card (the top seeds rest), the divisional
 * round re-seeded (the top seed plays the lowest left), the conference games and the Super Bowl.
 * Games whose result is not known yet have no winner.
 */
export function buildBracket(rows: readonly StandingRow[]): BracketGame[] {
  const games: BracketGame[] = [];
  const level = (r: StandingRow) => (r.playoffResult ? ROUNDS_WON[r.playoffResult] : -1);
  const play = (round: PlayoffRound, conference: Conference | null, a: StandingRow, b: StandingRow) => {
    const index = PLAYOFF_ROUNDS.indexOf(round);
    const [home, away] = (a.seed ?? 9) <= (b.seed ?? 9) || conference === null ? [a, b] : [b, a];
    const winner = level(home) > index ? home : level(away) > index ? away : null;
    games.push({
      round,
      conference,
      home: { teamAbbr: home.teamAbbr, seed: home.seed ?? 0 },
      away: { teamAbbr: away.teamAbbr, seed: away.seed ?? 0 },
      winner: winner?.teamAbbr ?? null,
    });
    return winner;
  };
  const champions: (StandingRow | null)[] = [];
  for (const conference of CONFERENCES) {
    const seeded = rows
      .filter((r) => r.conference === conference && r.seed !== undefined)
      .sort((a, b) => a.seed! - b.seed!);
    if (seeded.length < 2) continue;
    // Seven seeds since 2020 (one bye), six before (two).
    const byes = Math.max(0, 8 - seeded.length);
    const wildCard = outsideIn(seeded.slice(byes)).map(([a, b]) => play("wc", conference, a, b));
    const divisional = [...seeded.slice(0, byes), ...wildCard.filter((w): w is StandingRow => w !== null)];
    if (divisional.length < 4) {
      champions.push(null);
      continue;
    }
    divisional.sort((a, b) => a.seed! - b.seed!);
    const finalists = outsideIn(divisional).map(([a, b]) => play("div", conference, a, b));
    const [a, b] = finalists;
    champions.push(a && b ? play("conf", conference, a, b) : null);
  }
  const [afc, nfc] = champions;
  if (afc && nfc) play("sb", null, afc, nfc);
  return games;
}

export type Champions = { afc: string | null; nfc: string | null; superBowl: string | null };

/** Who won each conference and the Super Bowl: the teams whose runs reached the last game. */
export function championsOf(rows: readonly StandingRow[]): Champions {
  const reached = (conference: Conference) =>
    rows.find((r) => r.conference === conference && r.playoffResult && ROUNDS_WON[r.playoffResult] >= 3)
      ?.teamAbbr ?? null;
  return {
    afc: reached("AFC"),
    nfc: reached("NFC"),
    superBowl: rows.find((r) => r.playoffResult === "champion")?.teamAbbr ?? null,
  };
}

export type TableRow = {
  teamAbbr: string;
  seasons: number;
  w: number;
  l: number;
  t: number;
  playoffs: number;
  playoffW: number;
  playoffL: number;
  divisionTitles: number;
  conferenceTitles: number;
  superBowls: number;
};

/**
 * The all-time league table over any set of seasons: records, playoff trips and the playoff
 * record (a bye is not a win), division and conference titles, Super Bowls. Best record first.
 */
export function leagueTable(seasons: readonly (readonly StandingRow[])[]): TableRow[] {
  const table = new Map<string, TableRow>();
  for (const rows of seasons) {
    const seeds = Math.max(0, ...rows.map((r) => r.seed ?? 0));
    const byes = seeds > 0 ? Math.max(0, 8 - seeds) : 0;
    for (const r of rows) {
      const row =
        table.get(r.teamAbbr) ??
        ({
          teamAbbr: r.teamAbbr,
          seasons: 0,
          w: 0,
          l: 0,
          t: 0,
          playoffs: 0,
          playoffW: 0,
          playoffL: 0,
          divisionTitles: 0,
          conferenceTitles: 0,
          superBowls: 0,
        } satisfies TableRow);
      row.seasons++;
      row.w += r.w;
      row.l += r.l;
      row.t += r.t;
      if (r.divisionRank === 1) row.divisionTitles++;
      const won = r.playoffResult ? ROUNDS_WON[r.playoffResult] : -1;
      if (won >= 0) {
        row.playoffs++;
        const bye = r.seed !== undefined && r.seed <= byes ? 1 : 0;
        row.playoffW += Math.max(0, won - bye);
        if (r.playoffResult !== "champion") row.playoffL++;
      }
      if (won >= 3) row.conferenceTitles++;
      if (r.playoffResult === "champion") row.superBowls++;
      table.set(r.teamAbbr, row);
    }
  }
  return [...table.values()].sort(
    (a, b) => b.superBowls - a.superBowls || pct(b) - pct(a) || a.teamAbbr.localeCompare(b.teamAbbr),
  );
}

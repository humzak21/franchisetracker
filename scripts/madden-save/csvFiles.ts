/**
 * The bundle as CSV files the app's list import takes as they are (FEATURES.md 5.11: "any list
 * can take its rows from a CSV file whose header names the columns"). One file per screen and
 * season, under the folder of the target it is uploaded to.
 */
import { PLAYOFF_RESULT_LABELS } from "../../shared/domain/calendar";
import { RAW_STATS, type RawStatKey } from "../../shared/stats/registry";
import { toCsv, type Cell } from "./csv";
import type { ExportBundle } from "./types";

type Files = Map<string, string>;

const group = <T>(rows: T[], key: (row: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(key(row), [...(out.get(key(row)) ?? []), row]);
  return out;
};

const add = <T>(
  files: Files,
  rows: T[],
  key: (row: T) => string,
  header: string[],
  cells: (row: T) => Cell[],
) => {
  for (const [path, group_] of group(rows, key)) files.set(path, toCsv(header, group_.map(cells)));
};

export function csvFiles(bundle: ExportBundle): Files {
  const files: Files = new Map();
  const { startYear } = bundle.franchise;
  const since = <T extends { year: number }>(rows: T[]) => rows.filter((r) => r.year >= startYear);

  add(
    files,
    bundle.games,
    (g) => `schedule/${g.year}.csv`,
    ["week", "awayTeam", "homeTeam", "awayScore", "homeScore"],
    (g) => [g.week, g.awayAbbr, g.homeAbbr, g.awayScore, g.homeScore],
  );
  add(
    files,
    bundle.standings,
    (s) => `standings/${s.year}.csv`,
    ["team", "w", "l", "t", "divisionRank", "seed", "pointsFor", "pointsAgainst"],
    (s) => [s.teamAbbr, s.w, s.l, s.t, s.divisionRank, s.seed, s.pointsFor, s.pointsAgainst],
  );
  add(
    files,
    bundle.teamSeasons,
    (s) => `team-history/${s.teamAbbr}.csv`,
    ["year", "w", "l", "t", "playoffResult", "note"],
    (s) => [
      s.year,
      s.w,
      s.l,
      s.t,
      s.playoffResult === null ? null : PLAYOFF_RESULT_LABELS[s.playoffResult],
      [s.wonDivision ? "won division" : null, s.madePlayoffs && !s.playoffResult ? "made playoffs" : null]
        .filter(Boolean)
        .join(", ") || null,
    ],
  );
  add(
    files,
    bundle.rosters,
    (r) => `rosters/${r.year}/${r.teamAbbr}.csv`,
    ["player", "position", "jersey", "ovr", "age", "exp", "devTrait", "status"],
    (r) => [r.name, r.position, r.jersey, r.ovr, r.age, r.exp, r.devTrait, r.status],
  );
  for (const [year, rows] of group(bundle.seasonStats, (r) => String(r.year))) {
    const keys = (Object.keys(RAW_STATS) as RawStatKey[]).filter((k) => rows.some((r) => k in r.stats));
    files.set(
      `season-stats/${year}.csv`,
      toCsv(
        ["player", "team", "position", "gamesPlayed", ...keys],
        rows.map((r) => [
          r.name,
          r.teamAbbr,
          r.position,
          r.gamesPlayed,
          ...keys.map((k) => r.stats[k] ?? null),
        ]),
      ),
    );
  }
  add(
    files,
    since(bundle.awards).filter((a) => a.week),
    (a) => `awards/weekly/${a.year}-${a.week}.csv`,
    ["player", "team", "award", "conference", "position"],
    (a) => [a.name, a.teamAbbr, a.award, a.conference, a.position],
  );
  add(
    files,
    since(bundle.awards).filter((a) => !a.week),
    (a) => `awards/yearly/${a.year}.csv`,
    ["player", "team", "award", "conference", "position"],
    (a) => [a.name, a.teamAbbr, a.award, a.conference, a.position],
  );
  add(
    files,
    bundle.draft,
    (d) => `draft/${d.year}.csv`,
    ["player", "team", "round", "pickInRound", "position", "ovr", "age"],
    (d) => [d.name, d.teamAbbr, d.round, d.pickInRound, d.position, d.ovr, d.age],
  );
  add(
    files,
    bundle.injuries,
    (i) => `injuries/${i.year}.csv`,
    ["player", "team", "position", "injury", "length", "weeks", "ir"],
    (i) => [i.name, i.teamAbbr, i.position, i.injury, `${i.weeksMin}-${i.weeksMax} weeks`, i.weeksMax, i.ir],
  );
  return files;
}

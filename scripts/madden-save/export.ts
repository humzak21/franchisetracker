#!/usr/bin/env -S npx tsx
/**
 * `npm run export:madden -- <CAREER file> [--out <folder>]`: reads a Madden 27 franchise save
 * and writes its content in the app's own terms (docs/MADDEN-SAVE.md): one JSON bundle, a JSON
 * game log per played game, and CSV files the app's list import takes as they are. Reads the
 * save only; it never writes to it or to any backend.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { awardRows } from "./awards";
import { seasonWeekKey, seasonYear } from "./calendar";
import { csvFiles } from "./csvFiles";
import { readGames } from "./games";
import { seasonStatRows, standingRows, teamSeasonRows } from "./league";
import { draftRows, freeAgentRows, injuryRows, readPlayers, rosterRows } from "./players";
import { num, SaveFile, str } from "./saveFile";
import { Teams } from "./teams";
import type { ExportBundle } from "./types";

function parseArgs(argv: string[]): { file: string; out: string } {
  const [file, ...rest] = argv;
  if (!file || file.startsWith("-")) {
    console.error("Usage: npm run export:madden -- <CAREER file> [--out <folder>]");
    process.exit(2);
  }
  const outIndex = rest.indexOf("--out");
  const out = outIndex >= 0 ? rest[outIndex + 1] : undefined;
  return { file: resolve(file), out: resolve(out ?? join(dirname(file), `${basename(file)}-export`)) };
}

async function readBundle(file: string): Promise<ExportBundle> {
  const save = await SaveFile.open(file);
  const [info] = await save.rows("SeasonInfo");
  if (!info) throw new Error("No SeasonInfo table: is this a franchise save?");
  const baseYear = num(info.row, "BaseCalendarYear");
  const currentYearIndex = num(info.row, "CurrentYear");
  const currentYear = seasonYear(baseYear, currentYearIndex);
  const weekType = str(info.row, "CurrentWeekType");
  const inSeason = [
    "RegularSeason",
    "WildcardPlayoff",
    "DivisionalPlayoff",
    "ConferencePlayoff",
    "SuperBowl",
  ];

  const teams = await Teams.read(save);
  const players = await readPlayers(save);
  const [user] = await save.rows("FranchiseUser", ["Team"]);
  const games = await readGames(save, teams, players, baseYear);

  return {
    source: {
      file: basename(file),
      game: `Madden ${save.gameYear}`,
      schema: save.schemaVersion,
      exportedAt: new Date().toISOString(),
    },
    franchise: {
      userTeamAbbr: user ? (teams.ofRef(save, user.row.Team)?.abbr ?? null) : null,
      startYear: baseYear,
      currentYear,
      currentWeek: inSeason.includes(weekType) ? seasonWeekKey(num(info.row, "CurrentWeek")) : null,
      stage: `${str(info.row, "CurrentStage")} / ${weekType}`,
    },
    teams: teams.exported,
    games,
    rosters: rosterRows(players, teams, currentYear),
    freeAgents: freeAgentRows(players),
    standings: standingRows(teams, currentYear),
    teamSeasons: await teamSeasonRows(save, teams, baseYear, currentYearIndex),
    seasonStats: await seasonStatRows(save, teams, players, baseYear),
    awards: await awardRows(save, teams, players, {
      baseYear,
      currentYearIndex,
      currentWeek: inSeason.includes(weekType) ? num(info.row, "CurrentWeek") : null,
      beforeSeason: weekType === "PreSeason",
    }),
    draft: draftRows(players, teams, currentYear, baseYear),
    injuries: injuryRows(players, teams, currentYear),
  };
}

function write(out: string, path: string, text: string) {
  const full = join(out, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

const { file, out } = parseArgs(process.argv.slice(2));
const started = Date.now();
const bundle = await readBundle(file);
write(out, "madden-export.json", JSON.stringify(bundle, null, 2));
let logs = 0;
for (const game of bundle.games) {
  if (!game.played || (game.lines.length === 0 && game.teams.length === 0)) continue;
  write(
    out,
    `games/${game.year}/${game.week}-${game.awayAbbr}-at-${game.homeAbbr}.json`,
    JSON.stringify(game, null, 2),
  );
  logs++;
}
const csv = csvFiles(bundle);
for (const [path, text] of csv) write(out, `csv/${path}`, text);

const { franchise } = bundle;
console.log(
  `${bundle.source.game} save: ${franchise.userTeamAbbr ?? "?"} franchise, ${franchise.startYear} to ${franchise.currentYear}, next up ${franchise.currentWeek ?? franchise.stage}`,
);
console.log(
  `${bundle.games.length} games (${logs} with a box score), ${bundle.rosters.length} roster rows, ${bundle.seasonStats.length} season lines, ${bundle.awards.length} awards, ${bundle.draft.length} draft picks, ${bundle.injuries.length} injuries`,
);
console.log(
  `Wrote madden-export.json, ${logs} game logs and ${csv.size} CSV files to ${out} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);

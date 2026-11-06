/**
 * The save's games: every SeasonGame row with its score, and for games whose box score is still
 * in the save (the current season's, plus a few the game keeps), every player's line, both
 * teams' stats and the scoring summary.
 */
import { WEEK_KEYS } from "../../shared/domain/calendar";
import { PAT_LABELS, type PatResult } from "../../shared/domain/scoring";
import { weekKeyOf } from "./calendar";
import type { MaddenPlayer } from "./players";
import { num, str, type Row, type SaveFile } from "./saveFile";
import { mapPlayerStats, mapTeamStats } from "./statMap";
import type { Teams } from "./teams";
import type { ExportGame, GameLine, ScoringPlay } from "./types";

type Shell = { game: ExportGame; row: Row };

function shellOf(save: SaveFile, teams: Teams, baseYear: number, row: Row): ExportGame | null {
  const home = teams.ofRef(save, row.HomeTeam);
  const away = teams.ofRef(save, row.AwayTeam);
  const week = weekKeyOf(str(row, "SeasonWeekType"), num(row, "SeasonWeek"));
  if (!home || !away || !week) return null;
  const status = str(row, "GameStatus");
  const played = status === "HomeWon" || status === "AwayWon";
  const overtime = row.IsOvertimeGame === true;
  const quarters = (side: "Home" | "Away") => [
    ...[1, 2, 3, 4].map((q) => num(row, `${side}ScoreQuarter${q}`)),
    ...(overtime ? [num(row, `${side}ScoreOT`)] : []),
  ];
  return {
    year: baseYear + num(row, "SeasonYear"),
    week,
    awayAbbr: away.abbr,
    homeAbbr: home.abbr,
    played,
    awayScore: played ? num(row, "AwayScore") : null,
    homeScore: played ? num(row, "HomeScore") : null,
    overtime,
    simmed: row.IsSimmed === true,
    lineScore: played ? { home: quarters("Home"), away: quarters("Away") } : null,
    weather: played
      ? { condition: str(row, "Weather"), temperatureF: num(row, "Temperature"), wind: str(row, "Wind") }
      : null,
    lines: [],
    teams: [],
    plays: [],
  };
}

/** Two stat rows of one player in one game (a defensive row and a return row) as one. */
function mergeRows(into: Row, from: Row): Row {
  for (const [field, value] of Object.entries(from)) {
    if (!(field in into) || into[field] === 0) into[field] = value;
  }
  return into;
}

async function readLines(save: SaveFile, teams: Teams, players: MaddenPlayer[], shells: Map<number, Shell>) {
  const perGame = new Map<number, Map<number, { player: MaddenPlayer; row: Row; teamAbbr: string }>>();
  for (const player of players) {
    for (const ref of await save.refsIn(player.gameStatsRef)) {
      const stat = await save.deref(ref);
      if (!stat) continue;
      const gameIndex = save.refIndex(stat.row.SeasonGame);
      const shell = gameIndex === null ? undefined : shells.get(gameIndex);
      if (gameIndex === null || !shell) continue;
      const { game } = shell;
      const opponent = teams.ofRef(save, stat.row.OpposingTeam)?.abbr ?? null;
      const own = teams.ofIndex(player.teamIndex)?.abbr ?? null;
      const teamAbbr =
        opponent === game.homeAbbr
          ? game.awayAbbr
          : opponent === game.awayAbbr
            ? game.homeAbbr
            : (own ?? game.homeAbbr);
      const lines = perGame.get(gameIndex) ?? new Map();
      perGame.set(gameIndex, lines);
      const existing = lines.get(player.index);
      if (existing) mergeRows(existing.row, stat.row);
      else lines.set(player.index, { player, row: { ...stat.row }, teamAbbr });
    }
  }
  for (const [gameIndex, lines] of perGame) {
    const shell = shells.get(gameIndex);
    if (!shell) continue;
    shell.game.lines = [...lines.values()]
      .map(({ player, row, teamAbbr }): GameLine => ({
        teamAbbr,
        name: player.name,
        position: player.position,
        started: num(row, "GAMESSTARTED") > 0,
        stats: mapPlayerStats(row),
      }))
      .filter((line) => Object.keys(line.stats).length > 0)
      .sort((a, b) => a.teamAbbr.localeCompare(b.teamAbbr) || a.name.localeCompare(b.name));
  }
}

async function readTeamStats(save: SaveFile, { game, row }: Shell) {
  for (const side of ["Home", "Away"] as const) {
    const stats = await save.deref(row[`${side}TeamStatCache`]);
    if (!stats) continue;
    const teamAbbr = side === "Home" ? game.homeAbbr : game.awayAbbr;
    const completions = game.lines.filter((l) => l.teamAbbr === teamAbbr).map((l) => l.stats.passCmp ?? 0);
    const passCmp = completions.length ? completions.reduce((a, b) => a + b, 0) : null;
    game.teams.push({ teamAbbr, stats: mapTeamStats(stats.row, passCmp) });
  }
}

/** What a score was worth says what it was; the try after a touchdown is the only play the save names. */
function classify(delta: number, conversion: string): Pick<ScoringPlay, "kind" | "pat" | "description"> {
  if (delta === 3) return { kind: "fg", pat: null, description: "Field goal" };
  if (delta === 2) return { kind: "safety", pat: null, description: "Safety" };
  if (delta >= 6 && delta <= 8) {
    const pat: PatResult =
      delta === 7 ? "kick" : delta === 8 ? "two" : conversion === "Touchdown" ? "two_failed" : "kick_failed";
    return {
      kind: "other",
      pat,
      description: `Touchdown, ${PAT_LABELS[pat].toLowerCase()} (play not in the save)`,
    };
  }
  return { kind: "other", pat: null, description: `${delta} points` };
}

async function readPlays(save: SaveFile, { game, row }: Shell) {
  const rows: Row[] = [];
  for (const ref of await save.refsIn(row.ScoringSummaries)) {
    const play = await save.deref(ref);
    if (play) rows.push(play.row);
  }
  // Quarter then time left; the running score after each play is the only reliable column.
  rows.sort(
    (a, b) => num(a, "Quarter") - num(b, "Quarter") || num(b, "TimeStampInSec") - num(a, "TimeStampInSec"),
  );
  let home = 0;
  let away = 0;
  for (const play of rows) {
    const homeScore = num(play, "HomeCurrentScore");
    const awayScore = num(play, "AwayCurrentScore");
    const homeScored = homeScore > home;
    const delta = homeScored ? homeScore - home : awayScore - away;
    if (delta <= 0) continue;
    game.plays.push({
      order: game.plays.length + 1,
      period: num(play, "Quarter"),
      clock: num(play, "TimeStampInSec"),
      teamAbbr: homeScored ? game.homeAbbr : game.awayAbbr,
      ...classify(delta, str(play, "Conversion")),
      homeScore,
      awayScore,
    });
    home = homeScore;
    away = awayScore;
  }
}

export async function readGames(
  save: SaveFile,
  teams: Teams,
  players: MaddenPlayer[],
  baseYear: number,
): Promise<ExportGame[]> {
  const shells = new Map<number, Shell>();
  for (const { index, row } of await save.rows("SeasonGame")) {
    const game = shellOf(save, teams, baseYear, row);
    if (game) shells.set(index, { game, row });
  }
  await readLines(save, teams, players, shells);
  for (const shell of shells.values()) {
    if (!shell.game.played) continue;
    await readTeamStats(save, shell);
    await readPlays(save, shell);
  }
  const weekOrder = (week: string) => (WEEK_KEYS as readonly string[]).indexOf(week);
  return [...shells.values()]
    .map((s) => s.game)
    .sort(
      (a, b) =>
        a.year - b.year || weekOrder(a.week) - weekOrder(b.week) || a.homeAbbr.localeCompare(b.homeAbbr),
    );
}

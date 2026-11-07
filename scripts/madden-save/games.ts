/**
 * The save's games: every SeasonGame row with its score, and for games whose box score is still
 * in the save (the current season's, plus a few the game keeps), every player's line, both
 * teams' stats and the scoring summary.
 */
import { WEEK_KEYS } from "../../shared/domain/calendar";
import { weekKeyOf } from "./calendar";
import type { MaddenPlayer } from "./players";
import { num, str, type Row, type SaveFile } from "./saveFile";
import { scoringPlays, type SummaryRow } from "./scoring";
import { mapPlayerStats, mapTeamStats } from "./statMap";
import type { Teams } from "./teams";
import type { ExportGame, GameLine } from "./types";

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

async function readPlays(save: SaveFile, { game, row }: Shell) {
  const rows: SummaryRow[] = [];
  for (const ref of await save.refsIn(row.ScoringSummaries)) {
    const play = (await save.deref(ref))?.row;
    if (!play) continue;
    rows.push({
      quarter: num(play, "Quarter"),
      timeLeft: num(play, "TimeStampInSec"),
      homePrevious: num(play, "HomePreviousScore"),
      homeCurrent: num(play, "HomeCurrentScore"),
      awayPrevious: num(play, "AwayPreviousScore"),
      awayCurrent: num(play, "AwayCurrentScore"),
      conversion: str(play, "Conversion"),
    });
  }
  game.plays = scoringPlays(
    rows,
    { home: game.homeScore ?? 0, away: game.awayScore ?? 0 },
    { home: game.homeAbbr, away: game.awayAbbr },
  );
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

/** Standings, every team's finished seasons, and every player's season totals, as the save keeps them. */
import type { MaddenPlayer } from "./players";
import { num, type Row, type SaveFile } from "./saveFile";
import { mapPlayerStats } from "./statMap";
import type { Teams } from "./teams";
import type { SeasonStatRow, StandingRow, TeamSeasonRow } from "./types";

/** This season's standings from the Team table's running counts. */
export function standingRows(teams: Teams, year: number): StandingRow[] {
  return teams.all
    .map(({ abbr, row }) => {
      const divisionRank = num(row, "CurSeasonDivStanding");
      const seed = num(row, "CurSeasonConfStanding");
      return {
        year,
        teamAbbr: abbr,
        w: num(row, "HomeWin") + num(row, "RoadWin"),
        l: num(row, "HomeLoss") + num(row, "RoadLoss"),
        t: num(row, "HomeTie") + num(row, "RoadTie"),
        divisionRank: divisionRank >= 0 ? divisionRank + 1 : null,
        seed: seed >= 0 && seed < 7 ? seed + 1 : null,
        pointsFor: num(row, "SeasonLeagPointsFor"),
        pointsAgainst: num(row, "SeasonLeagPointsAgainst"),
      };
    })
    .sort((a, b) => b.w - a.w || a.l - b.l || a.teamAbbr.localeCompare(b.teamAbbr));
}

/**
 * Each team's seasons from its `TeamSeasonStats` array, newest first: the season in progress,
 * then every finished one back to the real seasons the game shipped with. Only the franchise's
 * finished seasons come out; the save does not say which playoff round a loser went out in.
 */
export async function teamSeasonRows(
  save: SaveFile,
  teams: Teams,
  baseYear: number,
  currentYearIndex: number,
): Promise<TeamSeasonRow[]> {
  const rows: TeamSeasonRow[] = [];
  for (const team of teams.all) {
    const refs = await save.refsIn(team.row.TeamSeasonStats);
    for (const [i, ref] of refs.entries()) {
      const year = baseYear + currentYearIndex - i;
      if (i === 0 || year < baseYear) continue;
      const season = await save.deref(ref);
      if (!season) continue;
      const { row } = season;
      const madePlayoffs = num(row, "PLAYOFFSMADE") > 0;
      rows.push({
        year,
        teamAbbr: team.abbr,
        w: num(row, "WINS"),
        l: num(row, "LOSSES"),
        t: num(row, "TIES"),
        madePlayoffs,
        wonDivision: num(row, "WONDIVISION") > 0,
        playoffResult:
          num(row, "SUPERBOWLWINS") > 0
            ? "champion"
            : num(row, "SUPERBOWLSMADE") > 0
              ? "sb_loss"
              : madePlayoffs
                ? null
                : "missed",
      });
    }
  }
  return rows.sort((a, b) => a.year - b.year || b.w - a.w || a.teamAbbr.localeCompare(b.teamAbbr));
}

/** Two tables' rows for one player, season and team (offense and returns, say) as one. */
function mergeSeason(into: Row, from: Row): Row {
  for (const [field, value] of Object.entries(from)) {
    if (!(field in into) || into[field] === 0 || into[field] === false) into[field] = value;
  }
  return into;
}

/**
 * Every player's totals per franchise season and team from his `SeasonStats` array. Entries
 * for real seasons before the franchise point into the game's static data and are skipped.
 */
export async function seasonStatRows(
  save: SaveFile,
  teams: Teams,
  players: MaddenPlayer[],
  baseYear: number,
): Promise<SeasonStatRow[]> {
  const rows: SeasonStatRow[] = [];
  for (const player of players) {
    const bySeason = new Map<string, Row>();
    for (const ref of await save.refsIn(player.seasonStatsRef)) {
      const season = await save.deref(ref);
      if (!season) continue;
      const key = `${num(season.row, "SEAS_YEAR")}|${num(season.row, "YEARBYYEARTEAMINDEX")}`;
      const existing = bySeason.get(key);
      if (existing) mergeSeason(existing, season.row);
      else bySeason.set(key, { ...season.row });
    }
    for (const row of bySeason.values()) {
      const stats = mapPlayerStats(row);
      const gamesPlayed = num(row, "GAMESPLAYED");
      if (gamesPlayed === 0 && Object.keys(stats).length === 0) continue;
      rows.push({
        year: baseYear + num(row, "SEAS_YEAR"),
        teamAbbr: teams.ofIndex(num(row, "YEARBYYEARTEAMINDEX"))?.abbr ?? null,
        name: player.name,
        position: player.position,
        gamesPlayed,
        gamesStarted: num(row, "GAMESSTARTED"),
        stats,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.year - b.year || (a.teamAbbr ?? "").localeCompare(b.teamAbbr ?? "") || a.name.localeCompare(b.name),
  );
}

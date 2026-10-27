/**
 * Consistency rules for drafts. Run after extraction (stored with the extraction) and again on
 * every edit in review, so warnings clear as the user fixes them. Errors block commit.
 */
import { RAW_STATS, type RawStatKey, type StatLine } from "../stats/registry";
import type { TeamStatKey, TeamStatLine } from "../stats/teamRegistry";
import type { BoxScoreDraft, DraftWarning, GameHeader, TeamStatsDraft } from "./types";

/** [part, whole]: the first can never exceed the second. */
const PLAYER_BOUNDS: [RawStatKey, RawStatKey][] = [
  ["passCmp", "passAtt"],
  ["passTd", "passCmp"],
  ["rushTd", "rushAtt"],
  ["recTd", "rec"],
  ["rec", "recTargets"],
  ["fgm", "fga"],
  ["xpm", "xpa"],
  ["kickReturnTd", "kickReturns"],
  ["puntReturnTd", "puntReturns"],
];

const TEAM_BOUNDS: [TeamStatKey, TeamStatKey][] = [
  ["passCmp", "passAtt"],
  ["thirdDownConv", "thirdDownAtt"],
  ["fourthDownConv", "fourthDownAtt"],
  ["twoPtConv", "twoPtAtt"],
  ["redZoneTd", "redZoneAtt"],
];

const sum = (values: (number | undefined)[]) => values.reduce<number>((n, v) => n + (v ?? 0), 0);

export function validateHeader(game: GameHeader, requireScore: boolean): DraftWarning[] {
  const out: DraftWarning[] = [];
  if (!game.homeAbbr) out.push({ path: "game.homeAbbr", message: "Home team is missing", severity: "error" });
  if (!game.awayAbbr) out.push({ path: "game.awayAbbr", message: "Away team is missing", severity: "error" });
  if (game.homeAbbr && game.homeAbbr === game.awayAbbr) {
    out.push({ path: "game.awayAbbr", message: "Home and away are the same team", severity: "error" });
  }
  for (const side of ["home", "away"] as const) {
    const score = side === "home" ? game.homeScore : game.awayScore;
    const path = `game.${side}Score`;
    if (score === null) {
      if (requireScore) out.push({ path, message: `The ${side} score is missing`, severity: "error" });
      continue;
    }
    const quarters = game.lineScore?.[side];
    if (quarters && quarters.length > 0 && sum(quarters) !== score) {
      out.push({
        path,
        message: `The ${side} quarters add up to ${sum(quarters)}, not ${score}`,
        suggestedValue: sum(quarters),
        severity: "warning",
      });
    }
  }
  return out;
}

function lineBounds(stats: StatLine, path: string, name: string): DraftWarning[] {
  return PLAYER_BOUNDS.flatMap(([part, whole]) => {
    const a = stats[part];
    const b = stats[whole];
    if (a === undefined || b === undefined || a <= b) return [];
    const message = `${name}: ${RAW_STATS[part].label.toLowerCase()} (${a}) exceed ${RAW_STATS[whole].label.toLowerCase()} (${b})`;
    return [{ path: `${path}.stats.${part}`, message, severity: "error" as const }];
  });
}

/** Points a team's lines account for; extra points and two-point plays aside, never above the score. */
function minimumPoints(lines: StatLine[]): number {
  const total = (key: RawStatKey) => sum(lines.map((l) => l[key]));
  const tds =
    total("rushTd") + total("recTd") + total("defTd") + total("kickReturnTd") + total("puntReturnTd");
  return tds * 6 + total("xpm") + total("fgm") * 3 + total("safeties") * 2;
}

export function validateBoxScore(draft: BoxScoreDraft): DraftWarning[] {
  const out = validateHeader(draft.game, true);
  const teams = [draft.game.homeAbbr, draft.game.awayAbbr].filter((t): t is string => t !== null);
  for (const line of draft.lines) {
    const path = `lines.${line.id}`;
    if (!line.teamAbbr || !teams.includes(line.teamAbbr)) {
      out.push({
        path: `${path}.teamAbbr`,
        message: `${line.name}: pick which team they played for`,
        severity: "error",
      });
    }
    out.push(...lineBounds(line.stats, path, line.name));
    if (Object.keys(line.stats).length === 0) {
      out.push({ path, message: `${line.name} has no stats and will be skipped`, severity: "info" });
    }
    if (line.playerId === null && line.match.status === "ambiguous") {
      out.push({
        path: `${path}.name`,
        message: `${line.name}: choose which player this is`,
        severity: "warning",
      });
    } else if (line.playerId === null) {
      out.push({
        path: `${path}.name`,
        message: `${line.name} will be added as a new player`,
        severity: "info",
      });
    }
  }
  for (const abbr of teams) {
    const lines = draft.lines.filter((l) => l.teamAbbr === abbr).map((l) => l.stats);
    if (lines.length === 0) continue;
    const passYds = sum(lines.map((l) => l.passYds));
    const recYds = sum(lines.map((l) => l.recYds));
    if (passYds > 0 && recYds > 0 && passYds !== recYds) {
      out.push({
        message: `${abbr}: passing yards (${passYds}) and receiving yards (${recYds}) differ`,
        severity: "warning",
      });
    }
    const score = abbr === draft.game.homeAbbr ? draft.game.homeScore : draft.game.awayScore;
    const minimum = minimumPoints(lines);
    if (score !== null && minimum > score) {
      out.push({
        message: `${abbr}: the touchdowns and kicks add up to ${minimum}, more than ${score}`,
        severity: "warning",
      });
    }
  }
  return out;
}

function teamBounds(stats: TeamStatLine, path: string): DraftWarning[] {
  return TEAM_BOUNDS.flatMap(([part, whole]) => {
    const a = stats[part];
    const b = stats[whole];
    return a !== undefined && b !== undefined && a > b
      ? [{ path: `${path}.stats.${part}`, message: `${a} converted out of ${b}`, severity: "error" as const }]
      : [];
  });
}

export function validateTeamStats(draft: TeamStatsDraft): DraftWarning[] {
  const out = validateHeader(draft.game, false);
  const teams = [draft.game.homeAbbr, draft.game.awayAbbr];
  draft.teams.forEach((team, i) => {
    const path = `teams.${i}`;
    if (!team.teamAbbr || !teams.includes(team.teamAbbr)) {
      out.push({ path: `${path}.teamAbbr`, message: "Pick which team this column is", severity: "error" });
    }
    out.push(...teamBounds(team.stats, path));
    const { passYds, rushYds, totalYds } = team.stats;
    if (
      passYds !== undefined &&
      rushYds !== undefined &&
      totalYds !== undefined &&
      passYds + rushYds !== totalYds
    ) {
      out.push({
        path: `${path}.stats.totalYds`,
        message: `Passing plus rushing is ${passYds + rushYds}, not ${totalYds}`,
        suggestedValue: passYds + rushYds,
        severity: "warning",
      });
    }
  });
  return out;
}

export const blocksCommit = (warnings: readonly DraftWarning[]) =>
  warnings.some((w) => w.severity === "error");

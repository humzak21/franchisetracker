/**
 * Madden's scoring summary: every score of one game. The first row target tied to a game, so its
 * checks also read that game (`RowGameContext`): whose score went up, the final, the box score.
 * A row may have no player, because the screen sometimes drops a name; that never blocks a commit.
 */
import {
  isTouchdown,
  PAT_LABELS,
  PAT_RESULTS,
  periodNumber,
  plausiblePoints,
  playPoints,
  SCORING_KIND_LABELS,
  SCORING_KINDS,
  SCORING_PERIODS,
  type PatResult,
  type ScoringKind,
  type ScoringPeriod,
} from "../../domain/scoring";
import { periodLabel } from "../../games/lineScore";
import { SCORER_STAT, scoreCount, scorerCandidates, scorerMatch, type GameLine } from "../../games/scorers";
import { playWhen } from "../../games/scoringPlay";
import type { RawStatKey } from "../../stats/registry";
import type { DraftWarning, PlayerMatch } from "../types";
import type { DraftRow, RowGameContext, RowSpec, RowsDraft } from "./types";

const MAX_CLOCK = 15 * 60;

/** Seconds left from the clock as printed, or null when it is not one. */
export function parsePlayClock(text: string): number | null {
  const match = /^(\d{0,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const seconds = Number(match[1] || 0) * 60 + Number(match[2]);
  return seconds <= MAX_CLOCK && Number(match[2]) < 60 ? seconds : null;
}

const isPeriod = (value: unknown): value is ScoringPeriod =>
  (SCORING_PERIODS as readonly unknown[]).includes(value);
const isKind = (value: unknown): value is ScoringKind =>
  (SCORING_KINDS as readonly unknown[]).includes(value);
const isPat = (value: unknown): value is PatResult => (PAT_RESULTS as readonly unknown[]).includes(value);
const numberOf = (value: unknown) => (typeof value === "number" ? value : undefined);

export type ParsedPlay = {
  period: number;
  clock: number;
  kind: ScoringKind;
  yards?: number;
  pat?: PatResult;
  homeScore: number;
  awayScore: number;
};

/** A row's play, or null while a required field is missing or unreadable. */
export function parsePlay(row: Pick<DraftRow, "values">): ParsedPlay | null {
  const { quarter, clock, kind, homeScore, awayScore, yards, pat } = row.values;
  const seconds = typeof clock === "string" ? parsePlayClock(clock) : null;
  if (!isPeriod(quarter) || seconds === null || !isKind(kind)) return null;
  if (typeof homeScore !== "number" || typeof awayScore !== "number") return null;
  return {
    period: periodNumber(quarter),
    clock: seconds,
    kind,
    ...(numberOf(yards) !== undefined ? { yards: numberOf(yards) } : {}),
    ...(isPat(pat) ? { pat } : {}),
    homeScore,
    awayScore,
  };
}

const rowOrder = (row: Pick<DraftRow, "values">) => {
  const { quarter, clock, homeScore, awayScore } = row.values;
  return {
    period: isPeriod(quarter) ? periodNumber(quarter) : 99,
    left: typeof clock === "string" ? (parsePlayClock(clock) ?? -1) : -1,
    total: (numberOf(homeScore) ?? 0) + (numberOf(awayScore) ?? 0),
  };
};

/** Game order, for review and for the checks. */
export function compareRows(a: Pick<DraftRow, "values">, b: Pick<DraftRow, "values">): number {
  const [x, y] = [rowOrder(a), rowOrder(b)];
  return x.period - y.period || y.left - x.left || x.total - y.total;
}

const score = (away: number, home: number) => `${away}-${home}`;

function boxChecks(rows: readonly DraftRow[], game: RowGameContext): DraftWarning[] {
  const out: DraftWarning[] = [];
  for (const team of [game.awayAbbr, game.homeAbbr]) {
    const lines = game.lines.filter((l) => l.teamAbbr === team);
    if (lines.length === 0) continue;
    const ofTeam = rows.filter((r) => r.teamAbbr === team && isKind(r.values.kind));
    const stats = new Set<RawStatKey>(
      Object.values(SCORER_STAT).filter((s): s is RawStatKey => s !== undefined),
    );
    for (const stat of stats) {
      const plays = ofTeam.filter((r) => SCORER_STAT[r.values.kind as ScoringKind] === stat);
      const boxed = lines.reduce((n, l) => n + (l.stats[stat] ?? 0), 0);
      if (plays.length !== boxed) {
        out.push({
          message: `${team}: ${scoreCount(stat, plays.length)} in these plays, ${boxed} in the box score`,
          severity: "warning",
        });
        continue;
      }
      if (plays.some((r) => !r.playerId)) continue;
      for (const line of lines) {
        const count = plays.filter((r) => r.playerId === line.playerId).length;
        const inBox = line.stats[stat] ?? 0;
        if (count !== inBox) {
          out.push({
            message: `${line.name}: ${scoreCount(stat, count)} in these plays, ${inBox} in the box score`,
            severity: "warning",
          });
        }
      }
    }
  }
  return out;
}

/** The score has to move by exactly what each play is worth, for the team that made it. */
function runningScore(rows: readonly DraftRow[], game: RowGameContext | null | undefined): DraftWarning[] {
  const out: DraftWarning[] = [];
  let home = 0;
  let away = 0;
  for (const row of rows) {
    const play = parsePlay(row);
    if (!play) continue;
    const path = `rows.${row.id}`;
    const when = playWhen(play);
    const up = { home: play.homeScore - home, away: play.awayScore - away };
    const side = up.home > 0 && up.away === 0 ? "home" : up.away > 0 && up.home === 0 ? "away" : null;
    if (!side) {
      out.push({
        path: `${path}.values.homeScore`,
        message: `${when}: the score goes from ${score(away, home)} to ${score(play.awayScore, play.homeScore)} (away-home). A play is missing, not accepted, or misread`,
        severity: "error",
      });
    } else {
      const points = up[side];
      const exact = playPoints(play.kind, play.pat ?? null);
      if (exact !== null ? exact !== points : !plausiblePoints(play.kind).includes(points)) {
        out.push({
          path: `${path}.values.kind`,
          message: `${when}: ${SCORING_KIND_LABELS[play.kind].toLowerCase()}${
            isTouchdown(play.kind) && play.pat ? ` (${PAT_LABELS[play.pat].toLowerCase()})` : ""
          } cannot be worth ${points}`,
          severity: "error",
        });
      }
      const scorer = game ? (side === "home" ? game.homeAbbr : game.awayAbbr) : null;
      if (scorer && row.teamAbbr && row.teamAbbr !== scorer) {
        out.push({
          path: `${path}.teamAbbr`,
          message: `${when}: ${scorer}'s score went up, but this row says ${row.teamAbbr}`,
          severity: "error",
        });
      }
    }
    home = play.homeScore;
    away = play.awayScore;
  }
  const finalHome = game?.homeScore ?? null;
  const finalAway = game?.awayScore ?? null;
  if (rows.length > 0 && finalHome !== null && finalAway !== null) {
    if (home !== finalHome || away !== finalAway) {
      out.push({
        message: `These plays end ${score(away, home)} (away-home), but the game's final is ${score(finalAway, finalHome)}. A play is missing, not accepted, or misread`,
        severity: "error",
      });
    }
  }
  return out;
}

function scoringRules(draft: RowsDraft, game?: RowGameContext | null): DraftWarning[] {
  const rows = draft.rows.filter((r) => r.accepted).sort(compareRows);
  const out: DraftWarning[] = [];
  if (game === null) {
    out.push({
      message: "There is no game to file these under. Add the game to the schedule first",
      severity: "error",
    });
  }
  for (const row of rows) {
    const path = `rows.${row.id}`;
    const { clock } = row.values;
    if (typeof clock === "string" && parsePlayClock(clock) === null) {
      out.push({ path: `${path}.values.clock`, message: `"${clock}" is not a clock`, severity: "error" });
    }
    const play = parsePlay(row);
    const when = play ? playWhen(play) : "A play";
    if (!row.teamAbbr) {
      out.push({ path: `${path}.teamAbbr`, message: `${when}: pick the team`, severity: "error" });
    } else if (game && row.teamAbbr !== game.homeAbbr && row.teamAbbr !== game.awayAbbr) {
      out.push({
        path: `${path}.teamAbbr`,
        message: `${when}: ${row.teamAbbr} did not play in this game`,
        severity: "error",
      });
    }
    const scored = play && (isTouchdown(play.kind) || play.kind === "fg");
    if (scored && !row.name && !row.playerId) {
      out.push({ path: `${path}.name`, message: `${when}: needs a player`, severity: "warning" });
    }
  }
  return [...out, ...runningScore(rows, game), ...(game ? boxChecks(rows, game) : [])];
}

/** A line added in this review has no player yet, so it can be counted but not picked. */
export const NEW_LINE = "new-line:";
const isNewLine = (playerId: string) => playerId.startsWith(NEW_LINE);

/**
 * The row's candidates from the box score, for a row with no player yet. Null when it has one or
 * the box score offers nobody, leaving the row's own match to stand.
 */
export function rowScorerMatch<P extends string>(
  row: DraftRow<P>,
  rows: readonly DraftRow<P>[],
  game: RowGameContext<string>,
): PlayerMatch<P> | null {
  const { kind } = row.values;
  if (row.playerId || !isKind(kind)) return null;
  const others = rows.flatMap((r) =>
    r.id !== row.id && r.teamAbbr === row.teamAbbr && isKind(r.values.kind)
      ? [{ kind: r.values.kind, playerId: r.playerId }]
      : [],
  );
  const lines = game.lines.filter((l): l is GameLine<P> => !isNewLine(l.playerId));
  return scorerMatch(scorerCandidates(kind, row.teamAbbr, lines, others));
}

const periodOptions = SCORING_PERIODS.map((p, i) => ({ value: p, label: periodLabel(i) }));

export const scoringPlaysSpec: RowSpec = {
  player: true,
  optionalPlayer: true,
  rowTeam: true,
  meta: [],
  fields: () => [
    {
      key: "quarter",
      label: "Quarter",
      type: "enum",
      primary: true,
      required: true,
      options: periodOptions,
      hint: "The period the score came in",
    },
    {
      key: "clock",
      label: "Clock",
      type: "text",
      primary: true,
      required: true,
      hint: 'Time left in the period as printed, m:ss ("12:05")',
    },
    {
      key: "kind",
      label: "Play",
      type: "enum",
      primary: true,
      required: true,
      options: SCORING_KINDS.map((k) => ({ value: k, label: SCORING_KIND_LABELS[k] })),
      hint: "The kind of score, from the printed play",
    },
    { key: "yards", label: "Yards", type: "int", hint: "The play's length where printed (15 in 15 yd pass)" },
    {
      key: "passer",
      label: "Passer",
      type: "text",
      hint: 'On a passing touchdown, who threw it, as printed ("D. Maye"), else null',
    },
    {
      key: "pat",
      label: "Try",
      type: "enum",
      options: PAT_RESULTS.map((p) => ({ value: p, label: PAT_LABELS[p] })),
      hint: "After a touchdown, from the parenthesis, else null",
    },
    {
      key: "awayScore",
      label: "Away score",
      type: "int",
      primary: true,
      required: true,
      hint: "The away team's score after this play",
    },
    {
      key: "homeScore",
      label: "Home score",
      type: "int",
      primary: true,
      required: true,
      hint: "The home team's score after this play",
    },
    { key: "description", label: "As printed", type: "text", hint: "The whole play line exactly as printed" },
  ],
  // A read without a clock still tells scores apart by the score after it.
  identity: (row) => {
    const { quarter, clock, homeScore, awayScore } = row.values;
    const when = clock ?? `score ${String(awayScore)}-${String(homeScore)}`;
    return `${String(quarter)}|${String(when)}|${row.teamAbbr ?? "?"}`;
  },
  order: compareRows,
  caption: (row) => {
    const play = parsePlay(row);
    return play ? `${playWhen(play)} · ${score(play.awayScore, play.homeScore)}` : null;
  },
  rules: scoringRules,
};

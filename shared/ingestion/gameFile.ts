/**
 * A game log from a file instead of screenshots: one game as the Madden save exporter writes it
 * (`npm run export:madden`, docs/MADDEN-SAVE.md) becomes a full game log draft, filed under the
 * file's season and week and reviewed like any other. The file is checked here, since it comes
 * from disk: unknown teams, weeks or stat keys are refused or dropped, never trusted.
 */
import { isWeekKey, weekLabel, type WeekKey } from "../domain/calendar";
import { isPosition } from "../domain/positions";
import {
  PAT_RESULTS,
  SCORING_KINDS,
  SCORING_PERIODS,
  type PatResult,
  type ScoringKind,
} from "../domain/scoring";
import { resolveTeamAbbr } from "../domain/teams";
import { isRawStatKey, type StatLine } from "../stats/registry";
import { isTeamStatKey, type TeamStatLine } from "../stats/teamRegistry";
import { deriveDraft, isObj, lineId, num, rows, str, type Obj } from "./normalize";
import type { DraftRow } from "./rows/types";
import type { DraftLine, GameHeader, GameLogDraft } from "./types";

/** A game file read into a draft and where it is filed, or why it cannot be. */
export type GameFileResult<P extends string = string> =
  { ok: true; year: number; weekKey: WeekKey; draft: GameLogDraft<P> } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false, error }) as const;

function statsOf<K extends string>(
  raw: unknown,
  isKey: (key: string) => key is K,
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  if (!isObj(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (isKey(key) && typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

const scores = (value: unknown): number[] | null =>
  Array.isArray(value) && value.every((n) => typeof n === "number") ? value : null;

function headerOf(raw: Obj, homeAbbr: string, awayAbbr: string): GameHeader {
  const line = isObj(raw.lineScore) ? raw.lineScore : null;
  const home = line ? scores(line.home) : null;
  const away = line ? scores(line.away) : null;
  return {
    homeAbbr,
    awayAbbr,
    homeScore: num(raw.homeScore),
    awayScore: num(raw.awayScore),
    overtime: raw.overtime === true,
    lineScore: home && away && home.length > 0 && away.length > 0 ? { home, away } : null,
  };
}

function linesOf<P extends string>(raw: unknown, teams: ReadonlySet<string>): DraftLine<P>[] {
  const ids = new Set<string>();
  return rows(raw).flatMap((row): DraftLine<P>[] => {
    const name = str(row.name);
    const teamAbbr = resolveTeamAbbr(str(row.teamAbbr));
    if (!name || !teamAbbr || !teams.has(teamAbbr)) return [];
    const position = str(row.position);
    return [
      {
        id: lineId(teamAbbr, name, ids),
        teamAbbr,
        name,
        position: position && isPosition(position) ? position : null,
        stats: statsOf(row.stats, isRawStatKey) satisfies StatLine,
        playerId: null,
        match: { status: "new", candidates: [] },
      },
    ];
  });
}

function teamsOf(raw: unknown, teams: ReadonlySet<string>): GameLogDraft["teams"] {
  return rows(raw).flatMap((row) => {
    const teamAbbr = resolveTeamAbbr(str(row.teamAbbr));
    if (!teamAbbr || !teams.has(teamAbbr)) return [];
    return [{ teamAbbr, stats: statsOf(row.stats, isTeamStatKey) satisfies TeamStatLine }];
  });
}

const isKind = (value: unknown): value is ScoringKind =>
  (SCORING_KINDS as readonly unknown[]).includes(value);
const isPat = (value: unknown): value is PatResult => (PAT_RESULTS as readonly unknown[]).includes(value);

/** Seconds left as review prints a clock: 571 is "9:31". */
export const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * The scoring summary as review rows. The save names no scorer, so every row starts without a
 * player and review picks one from the box score; a touchdown the save could not type stays
 * `other` until review says which kind it was.
 */
function playsOf<P extends string>(raw: unknown, teams: ReadonlySet<string>): DraftRow<P>[] {
  return rows(raw).flatMap((row, i): DraftRow<P>[] => {
    const teamAbbr = resolveTeamAbbr(str(row.teamAbbr));
    const period = num(row.period);
    const clock = num(row.clock);
    if (!teamAbbr || !teams.has(teamAbbr) || period === null || clock === null) return [];
    return [
      {
        id: `play-${num(row.order) ?? i + 1}`,
        accepted: true,
        name: null,
        teamAbbr,
        values: {
          quarter: SCORING_PERIODS[period - 1] ?? null,
          clock: clockText(Math.max(0, Math.round(clock))),
          kind: isKind(row.kind) ? row.kind : "other",
          yards: null,
          passer: null,
          pat: isPat(row.pat) ? row.pat : null,
          awayScore: num(row.awayScore),
          homeScore: num(row.homeScore),
          description: str(row.description),
        },
        playerId: null,
        match: { status: "new", candidates: [] },
      },
    ];
  });
}

/** Reads one exported game (parsed JSON) into a full game log draft and the season and week it belongs to. */
export function gameFileDraft<P extends string = string>(raw: unknown): GameFileResult<P> {
  if (!isObj(raw)) return fail("This is not a game file");
  const year = num(raw.year);
  const week = str(raw.week);
  if (year === null || !Number.isInteger(year) || !week) return fail("The file names no season and week");
  if (!isWeekKey(week)) return fail(`"${week}" is not a week`);
  const homeAbbr = resolveTeamAbbr(str(raw.homeAbbr));
  const awayAbbr = resolveTeamAbbr(str(raw.awayAbbr));
  if (!homeAbbr || !awayAbbr) return fail("The file's teams are not NFL teams");
  if (raw.played === false) return fail("This game has not been played");
  const teams = new Set([homeAbbr, awayAbbr]);
  const draft: GameLogDraft<P> = deriveDraft({
    target: "game_log",
    game: headerOf(raw, homeAbbr, awayAbbr),
    lines: linesOf<P>(raw.lines, teams),
    teams: teamsOf(raw.teams, teams),
    plays: playsOf<P>(raw.plays, teams),
  });
  return { ok: true, year, weekKey: week, draft };
}

/** Reads a file's text: JSON first, then the game in it. */
export function gameFileFromText<P extends string = string>(text: string): GameFileResult<P> {
  try {
    return gameFileDraft<P>(JSON.parse(text) as unknown);
  } catch {
    return fail("This file is not JSON");
  }
}

/** How an imported file is named back to the user: "2028 Week 1 · NE at BUF". */
export function gameFileLabel(file: { year: number; weekKey: WeekKey; draft: Pick<GameLogDraft, "game"> }) {
  const { awayAbbr, homeAbbr } = file.draft.game;
  return `${file.year} ${weekLabel(file.weekKey, "long")} · ${awayAbbr ?? "?"} at ${homeAbbr ?? "?"}`;
}

/**
 * The stat explorer's question (`docs/STATS-HUB.md` 3): what is being asked, how it sits in a URL,
 * and where the answer can be read from. A board and the season rows are one read each; reading
 * game lines is bounded by asking for few seasons or one player, and anything wider is refused
 * rather than approximated.
 */
import { POSITION_GROUPS, type PositionGroup } from "../domain/positions";
import { formatStat } from "./format";
import { MARK_HORIZONS, MARK_STATS, markLabel, MARKS, type MarkHorizon, type MarkStat } from "./marks";
import { RECORD_STATS } from "./records";
import { STAT_KEYS, STAT_REGISTRY, isStatKey, type StatKey } from "./registry";
import { SPAN_WINDOWS, type SpanWindow } from "./spans";
import { splitLabel, splitTest } from "./splits";

export const EXPLORER_SCOPES = ["game", "season", "career", "span", "mark"] as const;
export type ExplorerScope = (typeof EXPLORER_SCOPES)[number];

export const EXPLORER_SCOPE_LABELS: Record<ExplorerScope, string> = {
  game: "Game",
  season: "Season",
  career: "Career",
  span: "Span",
  mark: "Fastest to",
};

/** Rows an answer shows. */
export const EXPLORER_LIMIT = 50;
/** Seasons a question may read game by game: about 600 lines each, so a fifth of a query's limit. */
export const MAX_SCAN_SEASONS = 5;

export type Question = {
  scope: ExplorerScope;
  statKey: StatKey;
  /** A split group's key (`regular` unless the question says otherwise). */
  split: string;
  window: SpanWindow;
  mark: number;
  horizon: MarkHorizon;
  position: PositionGroup | null;
  minGames: number;
  fromYear: number | null;
  toYear: number | null;
  playerId: string | null;
};

export const DEFAULT_QUESTION: Question = {
  scope: "season",
  statKey: "rushYds",
  split: "regular",
  window: 5,
  mark: 1000,
  horizon: "season",
  position: null,
  minGames: 0,
  fromYear: null,
  toYear: null,
  playerId: null,
};

const isMarkStat = (key: StatKey): key is MarkStat => (MARK_STATS as readonly StatKey[]).includes(key);

/** The stats a scope can rank: a single game has no per-game rates, marks and spans keep their own list. */
export function scopeStats(scope: ExplorerScope): readonly StatKey[] {
  if (scope === "span" || scope === "mark") return MARK_STATS;
  if (scope === "game")
    return STAT_KEYS.filter((k) => !("perGame" in STAT_REGISTRY[k] && STAT_REGISTRY[k].perGame));
  return STAT_KEYS;
}

export const usesMinGames = (scope: ExplorerScope) => scope === "season" || scope === "career";

/** A question made whole: a choice the scope or stat no longer offers falls back to one it does. */
export function settleQuestion(q: Question): Question {
  const stats = scopeStats(q.scope);
  const statKey = stats.includes(q.statKey) ? q.statKey : (stats[0] ?? DEFAULT_QUESTION.statKey);
  const marks: readonly number[] = isMarkStat(statKey) ? MARKS[statKey] : [];
  return {
    ...q,
    statKey,
    split: splitTest(q.split) ? q.split : DEFAULT_QUESTION.split,
    mark: marks.includes(q.mark) ? q.mark : (marks[0] ?? DEFAULT_QUESTION.mark),
    minGames: usesMinGames(q.scope) ? Math.max(0, Math.floor(q.minGames)) : 0,
  };
}

/** Why a question cannot be asked at all; the screens only ever send settled ones. */
export function questionProblem(
  q: Omit<Question, "statKey" | "window"> & { statKey: string; window: number },
): string | null {
  if (!isStatKey(q.statKey)) return `Unknown stat ${q.statKey}`;
  if (!scopeStats(q.scope).includes(q.statKey)) return `${q.statKey} has no ${q.scope} list`;
  if (!splitTest(q.split)) return `Unknown split ${q.split}`;
  if (q.scope === "span" && !(SPAN_WINDOWS as readonly number[]).includes(q.window))
    return `No ${q.window}-game span`;
  if (q.scope === "mark") {
    const marks: readonly number[] = isMarkStat(q.statKey) ? MARKS[q.statKey] : [];
    if (!marks.includes(q.mark)) return `No mark of ${q.mark}`;
  }
  return null;
}

/** A question as its URL holds it: only what differs from the default. */
export type ExplorerSearch = Partial<{
  scope: ExplorerScope;
  stat: StatKey;
  split: string;
  window: SpanWindow;
  mark: number;
  horizon: MarkHorizon;
  position: PositionGroup;
  minGames: number;
  from: number;
  to: number;
  player: string;
}>;

const oneOf = <T>(options: readonly T[], value: unknown): T | undefined => options.find((o) => o === value);
const whole = (value: unknown) => {
  const n = typeof value === "string" && value !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : undefined;
};
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

/** Reads a URL's question; anything unrecognised falls back to the default, never to an error. */
export function parseQuestion(search: Record<string, unknown>): Question {
  const d = DEFAULT_QUESTION;
  return settleQuestion({
    scope: oneOf(EXPLORER_SCOPES, search.scope) ?? d.scope,
    statKey: oneOf(STAT_KEYS, search.stat) ?? d.statKey,
    split: text(search.split) ?? d.split,
    window: oneOf(SPAN_WINDOWS, whole(search.window)) ?? d.window,
    mark: whole(search.mark) ?? d.mark,
    horizon: oneOf(MARK_HORIZONS, search.horizon) ?? d.horizon,
    position: oneOf(POSITION_GROUPS, search.position) ?? d.position,
    minGames: whole(search.minGames) ?? d.minGames,
    fromYear: whole(search.from) ?? d.fromYear,
    toYear: whole(search.to) ?? d.toYear,
    playerId: text(search.player) ?? d.playerId,
  });
}

export function questionSearch(q: Question): ExplorerSearch {
  const d = DEFAULT_QUESTION;
  const shown = <T>(value: T, fallback: T) => (value === fallback ? undefined : value);
  const search: ExplorerSearch = {
    scope: shown(q.scope, d.scope),
    stat: shown(q.statKey, d.statKey),
    split: shown(q.split, d.split),
    window: q.scope === "span" ? shown(q.window, d.window) : undefined,
    mark: q.scope === "mark" ? shown(q.mark, d.mark) : undefined,
    horizon: q.scope === "mark" ? shown(q.horizon, d.horizon) : undefined,
    position: q.position ?? undefined,
    minGames: shown(q.minGames, d.minGames),
    from: q.fromYear ?? undefined,
    to: q.toYear ?? undefined,
    player: q.playerId ?? undefined,
  };
  return Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined));
}

/** The record books' split for a group that is one, else null. */
export function bookSplit(split: string) {
  return split === "regular" ? "regular" : split === "playoffs" ? "postseason" : null;
}

export type Plan = { source: "board" | "seasons" | "lines" } | { refused: string };

/** Where a question's answer is read from; `seasonsAsked` is how many seasons its range covers. */
export function planQuestion(q: Question, seasonsAsked: number): Plan {
  const book = bookSplit(q.split);
  const allTime = q.fromYear === null && q.toYear === null;
  const plain = allTime && q.position === null && q.playerId === null;
  if (usesMinGames(q.scope) && book && q.playerId === null) return { source: "seasons" };
  if (plain && q.scope === "span" && book) return { source: "board" };
  if (plain && q.scope === "mark" && q.split === "regular") return { source: "board" };
  if (plain && q.scope === "game" && book && (RECORD_STATS as readonly StatKey[]).includes(q.statKey)) {
    return { source: "board" };
  }
  if (q.playerId !== null || seasonsAsked <= MAX_SCAN_SEASONS) return { source: "lines" };
  return {
    refused: `This question reads every game, so it can cover ${MAX_SCAN_SEASONS} seasons at most. Narrow the seasons, or pick one player.`,
  };
}

/** An answer's number: a stat, or the games a mark took. */
export const explorerValue = (q: Question, value: number) =>
  q.scope === "mark" ? `${value} games` : formatStat(q.statKey, value);

const rate = (key: StatKey) => STAT_REGISTRY[key].format !== "int" && STAT_REGISTRY[key].format !== "half";

const SCOPE_ENDINGS: Record<Exclude<ExplorerScope, "mark" | "span">, string> = {
  game: "in a game",
  season: "in a season",
  career: "in a career",
};

/** The question as a line of English, for the phone's summary and a page title. */
export function describeQuestion(q: Question) {
  const label = STAT_REGISTRY[q.statKey].label.toLowerCase();
  const lead =
    q.scope === "mark" && isMarkStat(q.statKey)
      ? `Fastest to ${markLabel({ statKey: q.statKey, mark: q.mark })}`
      : q.scope === "span"
        ? `Most ${label} in any ${q.window} games`
        : `${rate(q.statKey) ? "Highest" : "Most"} ${label} ${SCOPE_ENDINGS[q.scope as keyof typeof SCOPE_ENDINGS]}`;
  const years =
    q.fromYear === null && q.toYear === null
      ? null
      : q.fromYear === q.toYear
        ? String(q.fromYear)
        : `${q.fromYear ?? "First season"} to ${q.toYear ?? "now"}`;
  return [
    lead,
    q.split === "regular" ? null : splitLabel(q.split),
    q.position,
    years,
    q.minGames > 0 ? `at least ${q.minGames} games` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

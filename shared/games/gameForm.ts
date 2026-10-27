/**
 * A game entered or edited by hand (Schedule "Add game", game detail "Edit game"), turned into
 * the fields a `games` row stores. Scores come in from the user's side and are stored home/away.
 * Pure; the Convex mutations and the form share it.
 */
import { isPlayoffRound, type GameResult, type GameStatus, type PlayoffRound, type WeekKey } from "../domain";
import { resultOf } from "./summary";

export const MAX_SCORE = 200;
export const GAME_TEXT_LIMITS = { dateLabel: 40, stadium: 80, weather: 80, notes: 5000 } as const;

export type GameInput<T extends string> = {
  weekKey: WeekKey;
  /** A bye week: no opponent and no score. */
  bye: boolean;
  opponentTeamId?: T | null;
  userIsHome?: boolean;
  neutralSite?: boolean;
  /** The user team's points; with `them`, a final score. Both or neither. */
  us?: number | null;
  them?: number | null;
  overtime?: boolean;
  dateLabel?: string | null;
  stadium?: string | null;
  weather?: string | null;
};

/** Every header field a hand-entered game sets; `undefined` clears the field on an edit. */
export type GameFields<T extends string> = {
  weekKey: WeekKey;
  status: GameStatus;
  homeTeamId: T | undefined;
  awayTeamId: T | undefined;
  opponentTeamId: T | undefined;
  userIsHome: boolean | undefined;
  neutralSite: boolean | undefined;
  homeScore: number | undefined;
  awayScore: number | undefined;
  overtime: boolean | undefined;
  result: GameResult | undefined;
  playoffRound: PlayoffRound | undefined;
  dateLabel: string | undefined;
  stadium: string | undefined;
  weather: string | undefined;
};

export type Checked<V> = { ok: true; value: V } | { ok: false; error: string };

/** Trimmed text, `undefined` when blank. */
export function cleanText(text: string | null | undefined): string | undefined {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? undefined : trimmed;
}

const validScore = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_SCORE;

export function gameFields<T extends string>(input: GameInput<T>, userTeamId: T): Checked<GameFields<T>> {
  const text = {
    dateLabel: cleanText(input.dateLabel),
    stadium: cleanText(input.stadium),
    weather: cleanText(input.weather),
  };
  for (const key of ["dateLabel", "stadium", "weather"] as const) {
    if ((text[key]?.length ?? 0) > GAME_TEXT_LIMITS[key]) {
      return {
        ok: false,
        error: `Keep the ${key === "dateLabel" ? "date" : key} under ${GAME_TEXT_LIMITS[key]} characters`,
      };
    }
  }
  const base = {
    weekKey: input.weekKey,
    playoffRound: isPlayoffRound(input.weekKey) ? input.weekKey : undefined,
    ...text,
  };
  if (input.bye) {
    return {
      ok: true,
      value: {
        ...base,
        status: "bye",
        homeTeamId: undefined,
        awayTeamId: undefined,
        opponentTeamId: undefined,
        userIsHome: undefined,
        neutralSite: undefined,
        homeScore: undefined,
        awayScore: undefined,
        overtime: undefined,
        result: undefined,
      },
    };
  }
  const opponent = input.opponentTeamId;
  if (!opponent) return { ok: false, error: "Pick the opponent" };
  if (opponent === userTeamId) return { ok: false, error: "A team cannot play itself" };
  const us = input.us ?? null;
  const them = input.them ?? null;
  if ((us === null) !== (them === null)) return { ok: false, error: "Enter both scores, or neither" };
  if ((us !== null && !validScore(us)) || (them !== null && !validScore(them))) {
    return { ok: false, error: `Scores are whole numbers from 0 to ${MAX_SCORE}` };
  }
  const userIsHome = input.userIsHome ?? true;
  const scored = us !== null && them !== null;
  const homeScore = scored ? (userIsHome ? us : them) : undefined;
  const awayScore = scored ? (userIsHome ? them : us) : undefined;
  const status: GameStatus = scored ? "played" : "scheduled";
  return {
    ok: true,
    value: {
      ...base,
      status,
      homeTeamId: userIsHome ? userTeamId : opponent,
      awayTeamId: userIsHome ? opponent : userTeamId,
      opponentTeamId: opponent,
      userIsHome,
      neutralSite: input.neutralSite ? true : undefined,
      homeScore,
      awayScore,
      overtime: scored && input.overtime ? true : undefined,
      result: resultOf({ weekKey: input.weekKey, status, userIsHome, homeScore, awayScore }) ?? undefined,
    },
  };
}

/** Teams that had a side in the game before an edit and no longer do; their lines would be orphaned. */
export function droppedTeams<T extends string>(
  before: { homeTeamId?: T; awayTeamId?: T },
  after: { homeTeamId?: T; awayTeamId?: T },
): T[] {
  const kept = new Set([after.homeTeamId, after.awayTeamId]);
  return [before.homeTeamId, before.awayTeamId].filter((id): id is T => id !== undefined && !kept.has(id));
}

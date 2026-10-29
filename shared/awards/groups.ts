/**
 * How the awards screens lay awards out: the weekly board per conference, the season's league-wide
 * and per-conference awards, All-Pro and Pro Bowl. Slots nobody has won are kept apart so the
 * screens can show what is filled and tuck the rest away. Pure.
 */
import type { AwardType } from "../domain/awards";
import { REGULAR_WEEKS, weekIndex, type WeekKey } from "../domain/calendar";
import { POSITIONS, type Position } from "../domain/positions";
import { CONFERENCES, findTeamSeed, type Conference } from "../domain/teams";

export const WEEKLY_AWARDS = ["OPOW", "DPOW", "STPOW", "ROW"] as const satisfies readonly AwardType[];
/** Won once across the league, whatever the conference. */
export const LEAGUE_AWARDS = ["MVP", "COY", "SBMVP"] as const satisfies readonly AwardType[];
/** Won once per conference. */
export const CONFERENCE_AWARDS = [
  "OPOY",
  "DPOY",
  "OROY",
  "DROY",
  "CPOY",
  "BestQB",
  "BestRB",
  "BestWR",
  "BestTE",
  "BestOL",
  "BestDL",
  "BestLB",
  "BestDB",
  "BestK",
  "BestP",
  "BestKR",
] as const satisfies readonly AwardType[];

export type ConferenceAward = (typeof CONFERENCE_AWARDS)[number];
export function isConferenceAward(type: AwardType): type is ConferenceAward {
  return (CONFERENCE_AWARDS as readonly AwardType[]).includes(type);
}

export const WEEKLY_SHORT: Record<(typeof WEEKLY_AWARDS)[number], string> = {
  OPOW: "Offense",
  DPOW: "Defense",
  STPOW: "Special teams",
  ROW: "Rookie",
};

export type AwardLike = {
  type: AwardType;
  weekKey?: WeekKey;
  conference?: Conference;
  position?: Position;
  scope: "league" | "conference" | "team";
  team?: { abbr: string } | null;
};

/** One award to show: its winners (ties share it), none yet for an empty slot. */
export type Slot<T> = { type: AwardType; conference?: Conference; winners: T[] };

/** The award's conference: as stored, else the winner's team's. */
export function conferenceOf(award: AwardLike): Conference | undefined {
  return award.conference ?? (award.team ? findTeamSeed(award.team.abbr)?.conference : undefined);
}

/** Filled slots in order, and the empty ones apart. */
export function splitFilled<S extends { winners: readonly unknown[] }>(slots: readonly S[]) {
  return {
    filled: slots.filter((s) => s.winners.length > 0),
    empty: slots.filter((s) => s.winners.length === 0),
  };
}

const yearlyOf = <T extends AwardLike>(awards: readonly T[]) =>
  awards.filter((a) => !a.weekKey && a.scope !== "team");

/** Slots for awards won once across the league (MVP, Coach of the Year, the counted awards). */
export function leagueSlots<T extends AwardLike>(
  awards: readonly T[],
  types: readonly AwardType[],
): Slot<T>[] {
  const yearly = yearlyOf(awards);
  return types.map((type) => ({ type, winners: yearly.filter((a) => a.type === type) }));
}

/**
 * Each conference's slots for the per-conference awards. A winner whose conference cannot be told
 * (no conference stored, no team) is returned in `unplaced` so it is never hidden.
 */
export function conferenceSlots<T extends AwardLike>(awards: readonly T[]) {
  const yearly = yearlyOf(awards).filter((a) => isConferenceAward(a.type));
  return {
    conferences: CONFERENCES.map((conference) => ({
      conference,
      slots: CONFERENCE_AWARDS.map((type): Slot<T> => ({
        type,
        conference,
        winners: yearly.filter((a) => a.type === type && conferenceOf(a) === conference),
      })),
    })),
    unplaced: yearly.filter((a) => conferenceOf(a) === undefined),
  };
}

/** Weeks that have weekly awards, in calendar order. */
export function awardWeeks(awards: readonly AwardLike[]): WeekKey[] {
  const weekly = new Set<AwardType>(WEEKLY_AWARDS);
  const weeks = new Set(awards.flatMap((a) => (a.weekKey && weekly.has(a.type) ? [a.weekKey] : [])));
  return [...weeks].sort((a, b) => weekIndex(a) - weekIndex(b));
}

/** One week's winners: per conference, per weekly award. */
export function weekWinners<T extends AwardLike>(awards: readonly T[], week: WeekKey) {
  return CONFERENCES.map((conference) => ({
    conference,
    awards: WEEKLY_AWARDS.map((type) => ({
      type,
      winners: awards.filter((a) => a.weekKey === week && a.type === type && conferenceOf(a) === conference),
    })),
  }));
}

export type WeeklyGap = {
  week: WeekKey;
  missing: { conference: Conference; type: (typeof WEEKLY_AWARDS)[number] }[];
};

/** Regular-season weeks with weekly awards still to capture, and which slots each is missing. */
export function weeklyGaps(awards: readonly AwardLike[]): WeeklyGap[] {
  return REGULAR_WEEKS.flatMap((week) => {
    const missing = weekWinners(awards, week).flatMap(({ conference, awards: slots }) =>
      slots.filter((s) => s.winners.length === 0).map((s) => ({ conference, type: s.type })),
    );
    return missing.length > 0 ? [{ week, missing }] : [];
  });
}

const byPosition = <T extends AwardLike>(list: readonly T[]) =>
  [...list].sort((a, b) => POSITIONS.indexOf(a.position ?? "LS") - POSITIONS.indexOf(b.position ?? "LS"));

/** First and second team All-Pro, each in depth-chart order. */
export function allPro<T extends AwardLike>(awards: readonly T[]) {
  return (["AllPro1", "AllPro2"] as const).map((type) => ({
    type,
    players: byPosition(awards.filter((a) => a.type === type)),
  }));
}

/** Pro Bowl rosters per conference, in depth-chart order. */
export function proBowl<T extends AwardLike>(awards: readonly T[]) {
  return CONFERENCES.map((conference) => ({
    conference,
    players: byPosition(
      awards.filter((a) => a.type === "ProBowl" && (conferenceOf(a) ?? "AFC") === conference),
    ),
  }));
}

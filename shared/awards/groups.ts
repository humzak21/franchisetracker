/** How the awards screens lay awards out: the weekly grid, the yearly cabinet, All-Pro and Pro Bowl. Pure. */
import { AWARD_INFO, type AwardType } from "../domain/awards";
import { POSITIONS, type Position } from "../domain/positions";
import { CONFERENCES, type Conference } from "../domain/teams";
import { weekIndex, type WeekKey } from "../domain/calendar";

export const WEEKLY_AWARDS = ["OPOW", "DPOW", "STPOW", "ROW"] as const satisfies readonly AwardType[];
export const CABINET_AWARDS = [
  "MVP",
  "OPOY",
  "DPOY",
  "OROY",
  "DROY",
  "CPOY",
  "COY",
  "SBMVP",
  "BestK",
  "BestP",
  "BestKR",
  "BestQB",
  "BestRB",
  "BestWR",
  "BestTE",
  "BestOL",
  "BestDL",
  "BestLB",
  "BestDB",
] as const satisfies readonly AwardType[];

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
};

/** Weeks that have weekly awards, in calendar order. */
export function awardWeeks(awards: readonly AwardLike[]): WeekKey[] {
  const weeks = new Set(
    awards.flatMap((a) => (a.weekKey && AWARD_INFO[a.type].cadence === "weekly" ? [a.weekKey] : [])),
  );
  return [...weeks].sort((a, b) => weekIndex(a) - weekIndex(b));
}

/** One week's winners: per conference, per weekly award. */
export function weekWinners<T extends AwardLike>(awards: readonly T[], week: WeekKey) {
  return CONFERENCES.map((conference) => ({
    conference,
    awards: WEEKLY_AWARDS.map((type) => ({
      type,
      winners: awards.filter((a) => a.weekKey === week && a.type === type && a.conference === conference),
    })),
  }));
}

/** Every slot of these yearly awards in order, with its stored winners (none yet is an empty slot). */
export function cabinet<T extends AwardLike>(
  awards: readonly T[],
  types: readonly AwardType[] = CABINET_AWARDS,
) {
  const yearly = awards.filter((a) => !a.weekKey && a.scope !== "team");
  return types.map((type) => ({ type, winners: yearly.filter((a) => a.type === type) }));
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
    players: byPosition(awards.filter((a) => a.type === "ProBowl" && (a.conference ?? "AFC") === conference)),
  }));
}

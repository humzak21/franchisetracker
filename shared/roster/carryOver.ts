/**
 * What a roster entry becomes in the next season when the season advances (FEATURES.md 5.3).
 * Pure: the Convex carry-over reads and writes, this decides.
 */
import type { RosterStatus } from "../domain";
import { capHit, type CapContract } from "./cap";

/** Another team's player is carried while a commit named them in this many of the latest seasons. */
const SIGHTING_SEASONS = 2;

type CarriedFields = {
  status: RosterStatus;
  age?: number;
  exp?: number;
  statusWeekKey?: unknown;
  contract?: CapContract;
};

/**
 * Whether another team's player still belongs on its carried roster. A player nothing has dated
 * yet (an imported roster, or anyone from before sightings were kept) starts the clock here.
 */
export function stillSeen(lastSeenYear: number | undefined, fromYear: number): boolean {
  return lastSeenYear === undefined || fromYear - lastSeenYear < SIGHTING_SEASONS;
}

/** The contract a season later, and whether it has run out. An undated one stays as it is. */
export function agedContract(
  contract: CapContract,
  year: number,
): { contract: CapContract; expired: boolean } {
  const { years, expiresYear } = contract;
  if (years === undefined && expiresYear === undefined) return { contract, expired: false };
  const expired = expiresYear !== undefined ? expiresYear < year : years !== undefined && years <= 1;
  const hit = capHit(contract);
  return {
    contract: {
      ...contract,
      ...(years !== undefined ? { years: Math.max(years - 1, 0) } : {}),
      // The yearly figure is worked out from what was left, so it is pinned before that shrinks.
      ...(hit !== null ? { apy: hit } : {}),
    },
    expired,
  };
}

/**
 * The next season's version of an entry, or null for a player who left during the season
 * (released or traded away). Everyone a year older and more experienced with a year less on their
 * deal; injured reserve ends with the season, while the practice squad stays where it is until a
 * move says otherwise. A user-team deal that runs out waits on the owner; another team's is
 * dropped, since nothing here says whether they kept the player.
 */
export function carriedEntry<T extends CarriedFields>(
  entry: T,
  next: { year: number; userTeam: boolean },
): (Omit<T, "statusWeekKey" | "contract"> & { status: RosterStatus; contract?: CapContract }) | null {
  if (entry.status === "released" || entry.status === "traded") return null;
  const { statusWeekKey: _week, contract, ...rest } = entry;
  const aged = contract ? agedContract(contract, next.year) : null;
  const expires = aged?.expired === true;
  return {
    ...rest,
    status: expires && next.userTeam ? "unsigned" : entry.status === "ir" ? "active" : entry.status,
    ...(entry.age !== undefined ? { age: entry.age + 1 } : {}),
    ...(entry.exp !== undefined ? { exp: entry.exp + 1 } : {}),
    ...(aged && (next.userTeam || !expires) ? { contract: aged.contract } : {}),
  };
}

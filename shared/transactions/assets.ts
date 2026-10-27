/** Picks, contracts and trade sides for recorded moves (FEATURES.md 5.10). Pure. */
import type { Contract } from "./fields";

/** Rounds in a Madden draft. */
export const DRAFT_ROUNDS = 7;

export type PickAsset<T> = { year: number; round: number; originTeamId?: T };

/** A pick changing hands. Without an origin it is the sender's own, unless the sender holds one it acquired. */
export type PickMove<T> = PickAsset<T> & { fromTeamId: T; toTeamId: T };

/** "2027 R2", with the original team when it was someone else's. */
export function pickLabel(pick: { year: number; round: number }, origin?: string): string {
  return `${pick.year} R${pick.round}${origin ? ` (${origin})` : ""}`;
}

/** Every pick in a trade with its direction: `picksIn` come from the partner, `picksOut` go to it. */
export function planPicks<T>(
  teamId: T,
  counterpartTeamId: T,
  picksIn: readonly PickAsset<T>[],
  picksOut: readonly PickAsset<T>[],
): PickMove<T>[] {
  return [
    ...picksIn.map((p) => ({ ...p, fromTeamId: counterpartTeamId, toTeamId: teamId })),
    ...picksOut.map((p) => ({ ...p, fromTeamId: teamId, toTeamId: counterpartTeamId })),
  ];
}

/**
 * Contract terms as stored: empty fields dropped, the yearly average from the total when only
 * the total is known, and the last season it covers counting the move's season as year one.
 */
export function normalizeContract(contract: Contract | undefined, year: number): Contract | undefined {
  if (!contract) return undefined;
  const out: Contract = {};
  for (const key of ["years", "total", "apy", "guaranteed", "expiresYear"] as const) {
    const value = contract[key];
    if (value !== undefined && Number.isFinite(value)) out[key] = value;
  }
  if (out.apy === undefined && out.total !== undefined && out.years)
    out.apy = Math.round(out.total / out.years);
  if (out.expiresYear === undefined && out.years) out.expiresYear = year + out.years - 1;
  return Object.keys(out).length ? out : undefined;
}

export type TradeSides<T, A> = {
  teamId: T;
  counterpartTeamId?: T;
  playersIn: A[];
  playersOut: A[];
  picksIn: PickAsset<T>[];
  picksOut: PickAsset<T>[];
};

/** A trade the user team is part of reads from its side: it becomes the acting team. */
export function orientToUser<T, A, S extends TradeSides<T, A>>(trade: S, userTeamId: T): S {
  if (trade.counterpartTeamId !== userTeamId) return trade;
  return {
    ...trade,
    teamId: trade.counterpartTeamId,
    counterpartTeamId: trade.teamId,
    playersIn: trade.playersOut,
    playersOut: trade.playersIn,
    picksIn: trade.picksOut,
    picksOut: trade.picksIn,
  };
}

/** Why a pick cannot be recorded, or null. */
export function pickError(pick: { year: number; round: number }): string | null {
  if (!Number.isInteger(pick.year) || pick.year < 1970 || pick.year > 2100) return "Pick a draft year";
  if (!Number.isInteger(pick.round) || pick.round < 1 || pick.round > DRAFT_ROUNDS)
    return `Rounds run from 1 to ${DRAFT_ROUNDS}`;
  return null;
}

/** Why contract terms cannot be recorded, or null. */
export function contractError(contract: Contract | undefined): string | null {
  if (!contract) return null;
  const values = Object.values(contract).filter((v) => v !== undefined);
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return "Contract numbers can't be negative";
  if (
    contract.years !== undefined &&
    (!Number.isInteger(contract.years) || contract.years < 1 || contract.years > 10)
  )
    return "Contracts run 1 to 10 years";
  return null;
}

/**
 * Roster sync for a recorded move (FEATURES.md 5.10): which roster entries a trade, signing,
 * release or status change touches and what it writes on them. The mutation applies the plan
 * and stores what it changed so the move can be undone. Pure.
 */
import type { TransactionType, WeekKey } from "../domain";
import type { Acquisition, Contract, RosterFields } from "./fields";

export type MoveInput<T, P> = {
  type: TransactionType;
  /** The season the move belongs to. */
  year: number;
  weekKey?: WeekKey;
  /** The acting team: the user team in any move it is part of. */
  teamId: T;
  /** The trade partner, or the team that waived a claimed player. */
  counterpartTeamId?: T;
  /** Arriving at `teamId` (a trade's incoming players; the player in a signing). */
  playersIn: P[];
  /** Leaving `teamId`. */
  playersOut: P[];
  contract?: Contract;
  /** Abbreviations for the acquisition note ("From KC"). */
  teamLabel: string;
  counterpartLabel?: string;
  /** Labels of every asset each way, for the acquisition's counterparts. */
  assetsIn: string[];
  assetsOut: string[];
};

export type RosterOp<T, P> =
  /** Find or create the player's entry on the team; `createWith` applies only to a new entry. */
  | { kind: "ensure"; playerId: P; teamId: T; fromTeamId?: T; set: RosterFields; createWith?: RosterFields }
  /** Change the player's entry on the team if there is one. */
  | { kind: "update"; playerId: P; teamId: T; set: RosterFields }
  | { kind: "retire"; playerId: P };

/** Single-player moves list the player as arriving or leaving the acting team. */
export const MOVE_DIRECTION: Record<TransactionType, "in" | "out"> = {
  sign: "in",
  resign: "in",
  trade: "in",
  waiver_claim: "in",
  activate: "in",
  extension: "in",
  restructure: "in",
  release: "out",
  ir: "out",
  retire: "out",
};

export function planRoster<T, P>(move: MoveInput<T, P>): RosterOp<T, P>[] {
  const { type, teamId: team, counterpartTeamId: other, weekKey, year, contract } = move;
  const left = { statusWeekKey: weekKey };
  const players = [...move.playersIn, ...move.playersOut];
  const withContract: RosterFields = contract ? { contract } : {};
  const joined = (acquisition: Acquisition): RosterFields => ({
    status: "active",
    statusWeekKey: weekKey,
    acquisition,
    ...withContract,
  });

  switch (type) {
    case "trade": {
      if (other === undefined) return [];
      const via = (from: string | undefined, gave: string[]): Acquisition => ({
        type: "trade",
        year,
        ...(from ? { detail: `From ${from}` } : {}),
        ...(gave.length ? { counterparts: gave } : {}),
      });
      return [
        ...move.playersOut.flatMap((playerId): RosterOp<T, P>[] => [
          { kind: "update", playerId, teamId: team, set: { status: "traded", ...left } },
          {
            kind: "ensure",
            playerId,
            teamId: other,
            fromTeamId: team,
            set: joined(via(move.teamLabel, move.assetsIn)),
          },
        ]),
        ...move.playersIn.flatMap((playerId): RosterOp<T, P>[] => [
          { kind: "update", playerId, teamId: other, set: { status: "traded", ...left } },
          {
            kind: "ensure",
            playerId,
            teamId: team,
            fromTeamId: other,
            set: joined(via(move.counterpartLabel, move.assetsOut)),
          },
        ]),
      ];
    }
    case "sign":
      return players.map((playerId) => ({
        kind: "ensure",
        playerId,
        teamId: team,
        set: joined({ type: "free_agent", year }),
      }));
    case "waiver_claim":
      return players.flatMap((playerId): RosterOp<T, P>[] => [
        ...(other === undefined
          ? []
          : [
              {
                kind: "update" as const,
                playerId,
                teamId: other,
                set: { status: "released" as const, ...left },
              },
            ]),
        {
          kind: "ensure",
          playerId,
          teamId: team,
          fromTeamId: other,
          set: joined({
            type: "waiver",
            year,
            ...(move.counterpartLabel ? { detail: `From ${move.counterpartLabel}` } : {}),
          }),
        },
      ]);
    case "resign":
    case "extension":
    case "restructure":
      return players.map((playerId) => ({
        kind: "ensure",
        playerId,
        teamId: team,
        set: withContract,
        ...(type === "resign" ? { createWith: { acquisition: { type: "resign", year } } } : {}),
      }));
    case "release":
      return players.map((playerId) => ({
        kind: "update",
        playerId,
        teamId: team,
        set: { status: "released", ...left },
      }));
    case "ir":
      return players.map((playerId) => ({
        kind: "ensure",
        playerId,
        teamId: team,
        set: { status: "ir", ...left },
      }));
    case "activate":
      return players.map((playerId) => ({
        kind: "ensure",
        playerId,
        teamId: team,
        set: { status: "active", ...left },
      }));
    case "retire":
      return players.map((playerId) => ({ kind: "retire", playerId }));
  }
}

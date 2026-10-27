/** Form state for recording moves, and its mapping to and from the stored move. Pure. */
import type { Id } from "@convex/_generated/dataModel";
import type { Position, SeasonStatus, TransactionPhase, WeekKey } from "@shared/domain";
import type { Contract } from "@shared/transactions";
import type { Injury, Move } from "../types";

/** A player already in the app, or one typed in that the save creates. */
export type Person =
  | { kind: "existing"; playerId: Id<"players">; name: string; position?: Position }
  | { kind: "new"; name: string; position: Position; age?: number; ovr?: number };

export type PickDraft = { year: number; round: number; originTeamId?: Id<"teams"> };

export type Timing = { seasonId: Id<"seasons">; phase: TransactionPhase; weekKey?: WeekKey };

/** Contract fields as typed: years, and money in millions. */
export type ContractDraft = { years: string; total: string; apy: string; guaranteed: string };

export const EMPTY_CONTRACT: ContractDraft = { years: "", total: "", apy: "", guaranteed: "" };

export const personKey = (p: Person) => (p.kind === "existing" ? p.playerId : `new:${p.name}`);

export function toPersonInput(p: Person) {
  return p.kind === "existing"
    ? { playerId: p.playerId }
    : { name: p.name, position: p.position, age: p.age, ovr: p.ovr };
}

/** A stored move's player; one captured by name only is re-created by name on save. */
export function fromMovePerson(p: Move["playersIn"][number]): Person {
  return p.playerId
    ? { kind: "existing", playerId: p.playerId, name: p.name, position: p.position }
    : { kind: "new", name: p.name, position: p.position ?? "QB" };
}

/** Where a new move starts: the phase the season is in. */
export function defaultPhase(status: SeasonStatus): Pick<Timing, "phase" | "weekKey"> {
  if (status === "regular") return { phase: "regular", weekKey: "w1" };
  if (status === "postseason") return { phase: "postseason", weekKey: "wc" };
  return { phase: "offseason" };
}

export const timingOf = (move: Move, seasonId: Id<"seasons">): Timing => ({
  seasonId,
  phase: move.phase,
  weekKey: move.weekKey,
});

/** A whole number from a typed field, or undefined when blank or not a number. */
export function parseWhole(text: string): number | undefined {
  const n = Number(text.trim());
  return text.trim() === "" || !Number.isFinite(n) ? undefined : Math.round(n);
}

/** Dollars from a typed amount in millions ("22.5" is $22.5M). */
export function parseMillions(text: string): number | undefined {
  const n = Number(text.trim());
  return text.trim() === "" || !Number.isFinite(n) ? undefined : Math.round(n * 1_000_000);
}

const millions = (dollars: number | undefined) => (dollars === undefined ? "" : String(dollars / 1_000_000));

export function contractDraft(contract: Contract | undefined): ContractDraft {
  if (!contract) return EMPTY_CONTRACT;
  return {
    years: contract.years === undefined ? "" : String(contract.years),
    total: millions(contract.total),
    apy: millions(contract.apy),
    guaranteed: millions(contract.guaranteed),
  };
}

/** Terms to save, or undefined when nothing was typed. The server fills in the rest. */
export function contractInput(draft: ContractDraft): Contract | undefined {
  const contract: Contract = {};
  const years = parseWhole(draft.years);
  if (years !== undefined) contract.years = years;
  for (const key of ["total", "apy", "guaranteed"] as const) {
    const value = parseMillions(draft[key]);
    if (value !== undefined) contract[key] = value;
  }
  return Object.keys(contract).length ? contract : undefined;
}

/** Which sheet is open, and the move or injury it edits (none for a new one). */
export type Editing = { kind: "trade" | "sign" | "other"; move?: Move } | { kind: "injury"; injury?: Injury };

/** The sheet that edits a stored move: the trade builder, the signing form, or the other-move form. */
export const editingMove = (move: Move): Editing => ({
  kind: move.type === "trade" ? "trade" : move.type === "sign" ? "sign" : "other",
  move,
});

/** One team in the trade builder and what it sends. */
export type TradeSide = { teamId?: Id<"teams">; players: Person[]; picks: PickDraft[] };

/** A pick as the form shows it: a team's own pick carries no origin. */
const pickDraft = (p: Move["picksIn"][number], sender: Id<"teams"> | undefined): PickDraft => ({
  year: p.year,
  round: p.round,
  originTeamId: p.originTeamId && p.originTeamId !== sender ? p.originTeamId : undefined,
});

/** A stored trade as the builder's two sides: the acting team sends what went out. */
export function tradeSides(move: Move): [TradeSide, TradeSide] {
  const a = move.team?._id;
  const b = move.counterpart?._id;
  return [
    {
      teamId: a,
      players: move.playersOut.map(fromMovePerson),
      picks: move.picksOut.map((p) => pickDraft(p, a)),
    },
    {
      teamId: b,
      players: move.playersIn.map(fromMovePerson),
      picks: move.picksIn.map((p) => pickDraft(p, b)),
    },
  ];
}

/** The save arguments for a trade between the two sides, from the first side's view. */
export function tradeArgs(a: TradeSide, b: TradeSide, teamId: Id<"teams">) {
  return {
    teamId,
    counterpartTeamId: b.teamId,
    playersOut: a.players.map(toPersonInput),
    playersIn: b.players.map(toPersonInput),
    picksOut: a.picks,
    picksIn: b.picks,
  };
}

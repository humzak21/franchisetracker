/**
 * Manual entry: every screenshot target can be typed in by hand instead. A manual entry starts
 * from an empty draft of its target (`emptyDraft` in `./targets`) and is edited, checked and
 * committed by the same review editors and commit functions as an extraction. These helpers
 * build the empty pieces: a draft's starting header, a new list row, a new box score line.
 */
import type { Position } from "../domain/positions";
import type { RowSpec, DraftRow, RowValue, RowsDraft } from "./rows/types";
import type { DraftLine, GameHeader, PlayerMatch } from "./types";

/** A manual entry is open while it is being filled in, and committed once it has been written. */
export const MANUAL_DRAFT_STATUSES = ["open", "committed"] as const;
export type ManualDraftStatus = (typeof MANUAL_DRAFT_STATUSES)[number];

/** Who a new row or line is: a player picked from the rosters, or a name for a new player. */
export type NewEntry<P extends string = string> = {
  name?: string;
  playerId?: P | null;
  teamAbbr?: string | null;
  position?: Position | null;
};

/** The score header of a game not played yet: the user's team at home, nothing else known. */
export function emptyHeader(userTeamAbbr: string | null): GameHeader {
  return {
    homeAbbr: userTeamAbbr,
    awayAbbr: null,
    homeScore: null,
    awayScore: null,
    overtime: false,
    lineScore: null,
  };
}

/** A list with no rows. Screen fields naming a team (whose roster, whose stats) start as the user's. */
export function emptyRowsDraft<T extends string, P extends string = string>(
  target: T,
  spec: RowSpec,
  userTeamAbbr: string | null,
): RowsDraft<P, T> {
  const meta: Record<string, RowValue> = Object.fromEntries(
    spec.meta.map((field) => [field.key, field.type === "team" ? userTeamAbbr : null]),
  );
  return { target, meta, rows: [] };
}

/** An id no row or line in the draft has: `new-1`, `new-2`, ... */
export function manualId(taken: Iterable<string>): string {
  const ids = new Set(taken);
  let n = 1;
  while (ids.has(`new-${n}`)) n++;
  return `new-${n}`;
}

function matchOf<P extends string>(who: NewEntry<P>): PlayerMatch<P> {
  return who.playerId && who.name
    ? { status: "matched", candidates: [{ playerId: who.playerId, name: who.name, score: 1 }] }
    : { status: "new", candidates: [] };
}

/**
 * A blank row for a list, accepted because the user typed it. Every field starts empty so the
 * row card offers all of them, including season stats a screenshot would have shown.
 */
export function emptyRow<P extends string>(
  spec: RowSpec,
  draft: RowsDraft<P>,
  who: NewEntry<P> = {},
): DraftRow<P> {
  const values: Record<string, RowValue> = Object.fromEntries(spec.fields().map((f) => [f.key, null]));
  if (who.position && "position" in values) values.position = who.position;
  return {
    id: manualId(draft.rows.map((r) => r.id)),
    accepted: true,
    name: spec.player ? (who.name ?? (spec.optionalPlayer ? null : "")) : null,
    teamAbbr: who.teamAbbr ?? null,
    values,
    playerId: who.playerId ?? null,
    match: spec.player ? matchOf(who) : null,
  };
}

/** A box score line with no stats yet, for a player the screens would have listed. */
export function newLine<P extends string>(
  lines: readonly DraftLine<P>[],
  who: NewEntry<P> & { name: string },
): DraftLine<P> {
  return {
    id: manualId(lines.map((l) => l.id)),
    teamAbbr: who.teamAbbr ?? null,
    name: who.name,
    position: who.position ?? null,
    stats: {},
    playerId: who.playerId ?? null,
    match: matchOf(who),
  };
}

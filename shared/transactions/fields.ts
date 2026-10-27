/**
 * The roster fields a move may change, and how to undo exactly what it changed: a move records
 * each field's value before and after, and undoing restores a field only while it still holds
 * the move's value, so a manual edit made since is never clobbered. Pure.
 */
import type { AcquisitionType, DevTrait, Position, RosterStatus, WeekKey } from "../domain";

export type Contract = {
  years?: number;
  total?: number;
  apy?: number;
  guaranteed?: number;
  expiresYear?: number;
};

export type Acquisition = {
  type: AcquisitionType;
  year?: number;
  detail?: string;
  counterparts?: string[];
};

/** What a move writes on a roster entry. A key present with `undefined` clears the field. */
export type RosterFields = {
  status?: RosterStatus;
  statusWeekKey?: WeekKey;
  acquisition?: Acquisition;
  contract?: Contract;
};
export type RosterField = keyof RosterFields;

/** One entry's change, stored on the transaction so editing or deleting it can undo it. */
export type FieldChange = { changed: RosterField[]; prev: RosterFields; next: RosterFields };

/** Structural equality for stored values (objects from the database may order keys differently). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
    return [...keys].every((k) => sameValue(ra[k], rb[k]));
  }
  return false;
}

/** The fields `set` actually changes on `current`, with both values for each. */
export function diffFields(current: RosterFields, set: RosterFields): FieldChange {
  const change: FieldChange = { changed: [], prev: {}, next: {} };
  for (const key of Object.keys(set) as RosterField[]) {
    if (sameValue(current[key], set[key])) continue;
    change.changed.push(key);
    assign(change.prev, key, current[key]);
    assign(change.next, key, set[key]);
  }
  return change;
}

/** The patch that undoes a change: each field still holding the move's value goes back. */
export function undoPatch(current: RosterFields, change: FieldChange): RosterFields {
  const patch: RosterFields = {};
  for (const key of change.changed) {
    if (sameValue(current[key], change.next[key])) assign(patch, key, change.prev[key]);
  }
  return patch;
}

/** An entry a move created goes away on undo unless something since changed what the move set. */
export function untouchedSince(current: RosterFields, change: FieldChange): boolean {
  return change.changed.every((key) => sameValue(current[key], change.next[key]));
}

function assign<K extends RosterField>(target: RosterFields, key: K, value: RosterFields[K]) {
  target[key] = value;
}

/** The parts of an entry a player carries to a new team. */
export type CarriedEntry = {
  jersey?: number;
  position: Position;
  ovr?: number;
  devTrait?: DevTrait;
  abilities?: string[];
  age?: number;
  exp?: number;
};

/**
 * What a new entry copies from the player's last one. Age and experience only hold within the
 * same season; jersey, position, rating and dev trait are the best guess across seasons.
 */
export function carryOver(source: CarriedEntry, sameSeason: boolean): CarriedEntry {
  const carried: CarriedEntry = { position: source.position };
  if (source.jersey !== undefined) carried.jersey = source.jersey;
  if (source.ovr !== undefined) carried.ovr = source.ovr;
  if (source.devTrait !== undefined) carried.devTrait = source.devTrait;
  if (sameSeason) {
    if (source.abilities !== undefined) carried.abilities = source.abilities;
    if (source.age !== undefined) carried.age = source.age;
    if (source.exp !== undefined) carried.exp = source.exp;
  }
  return carried;
}

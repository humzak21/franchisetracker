/**
 * Player identity tools (FEATURES.md 5.4): spotting the same person entered twice, splitting a
 * display name, and keeping the alias list tidy. Pure.
 */
import { nameScore, nameTokens } from "../ingestion/nameMatch";
import { positionGroupOf, type Position } from "../domain/positions";

export type IdentityLike = { displayName: string; aliases: readonly string[]; position: Position };

/** Above this, two names are the same person typed or read differently ("Stefon Digs"). */
const SAME_PERSON = 0.93;
export const MAX_ALIASES = 20;

/** Name similarity in [0, 1]: the best of each name and alias against the other's full name. */
export function identityScore(a: IdentityLike, b: IdentityLike): number {
  const known = (p: IdentityLike) => {
    const tokens = nameTokens(p.displayName);
    return { first: tokens.slice(0, -1).join(" "), last: tokens.at(-1) ?? "", full: p.displayName };
  };
  const target = known(b);
  return Math.max(...[a.displayName, ...a.aliases].map((name) => nameScore(name, target)));
}

/** Likely the same person: near-identical names at compatible positions (same position group). */
export function likelyDuplicate(a: IdentityLike, b: IdentityLike): boolean {
  if (positionGroupOf(a.position) !== positionGroupOf(b.position)) return false;
  return Math.max(identityScore(a, b), identityScore(b, a)) >= SAME_PERSON;
}

/** "Amon-Ra St. Brown" → first "Amon-Ra", last "St. Brown"; particles stay with the last name. */
export function splitDisplayName(name: string): { firstName: string; lastName: string; displayName: string } {
  const displayName = name.trim().replace(/\s+/g, " ");
  const parts = displayName.split(" ");
  const particles = new Set(["st.", "st", "de", "van", "von", "la", "le", "del", "da", "di"]);
  let cut = parts.length - 1;
  while (cut > 1 && particles.has(parts[cut - 1]!.toLowerCase())) cut--;
  if (parts.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1]!))
    cut = Math.min(cut, parts.length - 2);
  return { firstName: parts.slice(0, cut).join(" "), lastName: parts.slice(cut).join(" "), displayName };
}

/** Aliases with `add` merged in: trimmed, case-insensitively unique, never the display name itself, capped. */
export function mergeAliases(
  displayName: string,
  current: readonly string[],
  add: readonly string[],
): string[] {
  const seen = new Set([displayName.trim().toLowerCase()]);
  const out: string[] = [];
  for (const alias of [...current, ...add]) {
    const trimmed = alias.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.slice(0, MAX_ALIASES);
}

/**
 * Player identity tools (FEATURES.md 5.4): spotting the same person entered twice, splitting a
 * display name, and keeping the alias list tidy. Pure.
 */
import { isShortened, nameScore, nameTokens } from "../ingestion/nameMatch";
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

/**
 * "Amon-Ra St. Brown" → first "Amon-Ra", last "St. Brown"; particles stay with the last name. A
 * list's "M.Hawkins" gains its space, so it reads as an initial and a surname rather than one long word.
 */
export function splitDisplayName(name: string): { firstName: string; lastName: string; displayName: string } {
  const displayName = name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^((?:\p{L}\.)+)(?=\p{L}{2})/u, "$1 ");
  const parts = displayName.split(" ");
  const particles = new Set(["st.", "st", "de", "van", "von", "la", "le", "del", "da", "di"]);
  let cut = parts.length - 1;
  while (cut > 1 && particles.has(parts[cut - 1]!.toLowerCase())) cut--;
  if (parts.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1]!))
    cut = Math.min(cut, parts.length - 2);
  return { firstName: parts.slice(0, cut).join(" "), lastName: parts.slice(cut).join(" "), displayName };
}

/** The alias list and the text its search index reads, always written together. */
export function aliasFields(aliases: readonly string[]): {
  aliases: string[];
  aliasesText: string | undefined;
} {
  return { aliases: [...aliases], aliasesText: aliases.length > 0 ? aliases.join(" ") : undefined };
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

/** A new player's name fields from how a screen printed it; a printing that was tidied stays an alias. */
export function newPlayerName(printed: string) {
  const name = splitDisplayName(printed);
  return { ...name, ...aliasFields(mergeAliases(name.displayName, [], [printed])) };
}

/** A fuller name for a one-initial player: "Marcellous Hawkins" for "M. Hawkins"; else null. */
export function upgradedName(current: string, printed: string): string | null {
  if (!isShortened(current) || isShortened(printed)) return null;
  const known = nameTokens(current);
  const read = nameTokens(printed);
  const [initial, ...surname] = known;
  const [first, ...rest] = read;
  if (initial?.length !== 1 || !first || first.length < 2 || !first.startsWith(initial)) return null;
  return surname.length > 0 && surname.join("") === rest.join("")
    ? splitDisplayName(printed).displayName
    : null;
}

/** First and last names as the old whitespace split stored them, for spotting a name to repair. */
function naiveSplit(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/);
  const lastName = parts.pop() ?? displayName;
  return { firstName: parts.join(" "), lastName };
}

/**
 * The proper split of a stored name, when it still carries the old naive one. A name edited by
 * hand no longer looks like that, so it is left alone. Null when nothing needs repairing.
 */
export function repairedName(player: {
  firstName: string;
  lastName: string;
  displayName: string;
  aliases: readonly string[];
}) {
  const naive = naiveSplit(player.displayName);
  if (naive.firstName !== player.firstName || naive.lastName !== player.lastName) return null;
  const name = splitDisplayName(player.displayName);
  if (
    name.displayName === player.displayName &&
    name.firstName === player.firstName &&
    name.lastName === player.lastName
  )
    return null;
  return { ...name, ...aliasFields(mergeAliases(name.displayName, player.aliases, [player.displayName])) };
}

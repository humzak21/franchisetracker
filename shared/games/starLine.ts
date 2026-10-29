/**
 * A star's stat line for the game, written the way it is said about a player (FEATURES.md 5.2):
 * "22/35, 62.9%, 452 yds, 3 TD" for a quarterback, "6 TKLs, 1.5 sacks, 1 INT" for a defender.
 * Built from the game's box score, so stars never need their numbers typed in. Pure.
 */
import { POSITION_INFO, type Position, type PositionGroup } from "../domain/positions";
import type { StatLine } from "../stats/registry";

const n = (line: StatLine, key: keyof StatLine) => line[key] ?? 0;

/** "1 TKL", "6 TKLs": counted abbreviations and words take an s past one. */
const count = (value: number, one: string, many = `${one}s`) => `${value} ${value === 1 ? one : many}`;

/** "12 yds", with a touchdown count after it when there was one. */
function yardsAndTd(line: StatLine, yards: keyof StatLine, td: keyof StatLine): string[] {
  return [`${n(line, yards)} yds`, ...(n(line, td) > 0 ? [`${n(line, td)} TD`] : [])];
}

function passing(line: StatLine): string[] {
  const att = n(line, "passAtt");
  if (att === 0) return [];
  const cmp = n(line, "passCmp");
  return [
    `${cmp}/${att}`,
    `${((cmp / att) * 100).toFixed(1)}%`,
    `${n(line, "passYds")} yds`,
    `${n(line, "passTd")} TD`,
    ...(n(line, "passInt") > 0 ? [`${n(line, "passInt")} INT`] : []),
  ];
}

const rushing = (line: StatLine) =>
  n(line, "rushAtt") > 0 ? [`${n(line, "rushAtt")} ATT`, ...yardsAndTd(line, "rushYds", "rushTd")] : [];

const receiving = (line: StatLine) =>
  n(line, "rec") > 0 ? [count(n(line, "rec"), "rec", "rec"), ...yardsAndTd(line, "recYds", "recTd")] : [];

/** Every defensive number that is not zero. */
function defense(line: StatLine): string[] {
  const parts: [number, string, string?][] = [
    [n(line, "tackles"), "TKL"],
    [n(line, "tacklesForLoss"), "TFL"],
    [n(line, "sacks"), "sack"],
    [n(line, "defInt"), "INT", "INT"],
    [n(line, "passDeflections"), "PDEF", "PDEF"],
    [n(line, "forcedFumbles"), "FF", "FF"],
    [n(line, "fumbleRecoveries"), "FR", "FR"],
    [n(line, "safeties"), "SFTY", "SFTY"],
    [n(line, "defTd"), "TD", "TD"],
  ];
  return parts.filter(([value]) => value !== 0).map(([value, one, many]) => count(value, one, many));
}

function kicking(line: StatLine): string[] {
  const out: string[] = [];
  if (n(line, "fga") > 0) out.push(`${n(line, "fgm")}/${n(line, "fga")} FG`);
  if (n(line, "fgLong") > 0) out.push(`${n(line, "fgLong")} long`);
  if (n(line, "xpa") > 0) out.push(`${n(line, "xpm")}/${n(line, "xpa")} XP`);
  return out;
}

function punting(line: StatLine): string[] {
  if (n(line, "punts") === 0) return [];
  return [
    count(n(line, "punts"), "punt"),
    `${n(line, "puntYds")} yds`,
    ...(n(line, "puntIn20") > 0 ? [`${n(line, "puntIn20")} IN20`] : []),
  ];
}

function returns(line: StatLine): string[] {
  const out: string[] = [];
  if (n(line, "kickReturns") > 0)
    out.push(`${n(line, "kickReturns")} KR`, ...yardsAndTd(line, "kickReturnYds", "kickReturnTd"));
  if (n(line, "puntReturns") > 0)
    out.push(`${n(line, "puntReturns")} PR`, ...yardsAndTd(line, "puntReturnYds", "puntReturnTd"));
  return out;
}

/** What each position's line leads with; a line with nothing there falls back to returns. */
const BY_GROUP: Partial<Record<PositionGroup, ((line: StatLine) => string[])[]>> = {
  QB: [passing, rushing],
  RB: [rushing, receiving],
  WR: [receiving, rushing],
  TE: [receiving, rushing],
  DL: [defense],
  LB: [defense],
  DB: [defense],
  K: [kicking],
  P: [punting],
};

/** The star's line for the game, or null when the box score has nothing for them. */
export function starStatLine(position: Position, line: StatLine): string | null {
  const parts = (BY_GROUP[POSITION_INFO[position].group] ?? []).flatMap((part) => part(line));
  const all = parts.length > 0 ? parts : returns(line);
  return all.length > 0 ? all.join(", ") : null;
}

/** Words a hand-typed stat line is made of ("22/30, 284 yds, 3 TD", "2 rush TD", "INT, 3 PD"). */
const STAT_WORDS = new Set(
  (
    "yd yds yards td tds touchdown touchdowns int ints interception interceptions rec recs reception " +
    "receptions catch catches att atts car carries rush rushes rushing pass passing receiving sack sacks " +
    "tkl tkls tackle tackles tfl tfls pd pds pdef pbu ff fr fum fumble fumbles fg fgs xp xps cmp comp " +
    "ypc ypa ypr long lng kr pr punt punts in20 sfty safety safeties rtg rating qbr def pick picks for"
  ).split(" "),
);

/** A part is a number (a count, a percentage or 22/30) followed by stat words, or stat words alone. */
function isStatPart(part: string): boolean {
  const match = /^(\d+(?:\.\d+)?%?|\d+\/\d+)?\s*([a-z0-9 ]*)$/i.exec(part.trim());
  if (!match) return false;
  const [, number, rest = ""] = match;
  const words = rest.split(/\s+/).filter(Boolean);
  if (!number && words.length === 0) return false;
  return words.every((w) => STAT_WORDS.has(w.toLowerCase()));
}

/**
 * Whether a star's hand-typed caption is only a stat line, written before lines came from the
 * box score. A caption with anything else in it ("Game-winning drive") is a note and is kept.
 */
export function isTypedStatLine(caption: string): boolean {
  const parts = caption.split(/[,;·]/).filter((p) => p.trim() !== "");
  return parts.length > 0 && parts.every(isStatPart);
}

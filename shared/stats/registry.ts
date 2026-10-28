/**
 * The stat registry: every stat is declared exactly once here (FEATURES.md principle 2).
 *
 * Raw stats are stored per player per game in `gameStatLines.stats` and aggregate with
 * `sum` or `max`. Derived stats are computed from raw totals and never stored on a game line.
 * Tables, highlights, leaderboards, extraction schemas and the real-history importer all read
 * from this file; adding a stat is one entry.
 */
import { POSITION_GROUPS, type PositionGroup } from "../domain/positions";
import { fantasyPoints } from "./fantasy";
import { pct, passerRating, perGame, safeDiv } from "./math";

export const STAT_CATEGORIES = [
  "passing",
  "rushing",
  "receiving",
  "defense",
  "kicking",
  "punting",
  "returns",
  "fantasy",
] as const;
export type StatCategory = (typeof STAT_CATEGORIES)[number];

/** The categories a box score records: every one but fantasy, which is scored from them. */
export const RAW_STAT_CATEGORIES = STAT_CATEGORIES.filter(
  (c): c is Exclude<StatCategory, "fantasy"> => c !== "fantasy",
);

export const STAT_CATEGORY_LABELS: Record<StatCategory, string> = {
  passing: "Passing",
  rushing: "Rushing",
  receiving: "Receiving",
  defense: "Defense",
  kicking: "Kicking",
  punting: "Punting",
  returns: "Returns",
  fantasy: "Fantasy",
};

/** Position groups whose stat tables show each category by default. */
export const CATEGORY_GROUPS: Record<StatCategory, readonly PositionGroup[]> = {
  passing: ["QB"],
  rushing: ["QB", "RB", "WR"],
  receiving: ["RB", "WR", "TE"],
  defense: ["DL", "LB", "DB"],
  kicking: ["K"],
  punting: ["P"],
  returns: ["RB", "WR", "DB"],
  fantasy: POSITION_GROUPS,
};

/** int: 1,234 · decimal: 4.4 · pct: 69.1% · rating: 105.6 · half: 3.5 (sacks) */
export type StatFormat = "int" | "decimal" | "pct" | "rating" | "half";

type BaseDef = {
  label: string;
  abbr: string;
  category: StatCategory;
  format: StatFormat;
  /** Which direction is good. Drives sort defaults and highlight tiers. */
  better: "higher" | "lower";
};

export type RawStatDef = BaseDef & { kind: "raw"; aggregation: "sum" | "max" };

const raw = (
  label: string,
  abbr: string,
  category: StatCategory,
  opts: Partial<Pick<RawStatDef, "format" | "better" | "aggregation">> = {},
): RawStatDef => ({
  kind: "raw",
  label,
  abbr,
  category,
  format: opts.format ?? "int",
  better: opts.better ?? "higher",
  aggregation: opts.aggregation ?? "sum",
});

export const RAW_STATS = {
  passCmp: raw("Completions", "CMP", "passing"),
  passAtt: raw("Pass attempts", "ATT", "passing"),
  passYds: raw("Passing yards", "YDS", "passing"),
  passTd: raw("Passing touchdowns", "TD", "passing"),
  passInt: raw("Interceptions thrown", "INT", "passing", { better: "lower" }),
  passSacked: raw("Times sacked", "SCK", "passing", { better: "lower" }),
  passSackYds: raw("Sack yards lost", "SYL", "passing", { better: "lower" }),
  passLong: raw("Longest pass", "LNG", "passing", { aggregation: "max" }),

  rushAtt: raw("Rush attempts", "ATT", "rushing"),
  rushYds: raw("Rushing yards", "YDS", "rushing"),
  rushTd: raw("Rushing touchdowns", "TD", "rushing"),
  rushLong: raw("Longest rush", "LNG", "rushing", { aggregation: "max" }),
  rushBrokenTackles: raw("Broken tackles", "BTK", "rushing"),
  fumbles: raw("Fumbles", "FUM", "rushing", { better: "lower" }),

  rec: raw("Receptions", "REC", "receiving"),
  recTargets: raw("Targets", "TGT", "receiving"),
  recYds: raw("Receiving yards", "YDS", "receiving"),
  recTd: raw("Receiving touchdowns", "TD", "receiving"),
  recLong: raw("Longest reception", "LNG", "receiving", { aggregation: "max" }),
  recYac: raw("Yards after catch", "YAC", "receiving"),
  recDrops: raw("Drops", "DRP", "receiving", { better: "lower" }),

  tackles: raw("Tackles", "TKL", "defense"),
  tacklesForLoss: raw("Tackles for loss", "TFL", "defense"),
  sacks: raw("Sacks", "SACK", "defense", { format: "half" }),
  defInt: raw("Interceptions", "INT", "defense"),
  defIntYds: raw("Interception return yards", "IYD", "defense"),
  passDeflections: raw("Pass deflections", "DEFL", "defense"),
  forcedFumbles: raw("Forced fumbles", "FF", "defense"),
  fumbleRecoveries: raw("Fumble recoveries", "FR", "defense"),
  safeties: raw("Safeties", "SFTY", "defense"),
  defTd: raw("Defensive touchdowns", "TD", "defense"),
  blockedKicks: raw("Blocked kicks", "BLK", "defense"),

  fgm: raw("Field goals made", "FGM", "kicking"),
  fga: raw("Field goal attempts", "FGA", "kicking"),
  fgLong: raw("Longest field goal", "LNG", "kicking", { aggregation: "max" }),
  fgBlocked: raw("Field goals blocked", "FGB", "kicking", { better: "lower" }),
  fgm0_29: raw("Field goals made, 0-29", "<30", "kicking"),
  fgm30_39: raw("Field goals made, 30-39", "30s", "kicking"),
  fgm40_49: raw("Field goals made, 40-49", "40s", "kicking"),
  fgm50plus: raw("Field goals made, 50+", "50+", "kicking"),
  xpm: raw("Extra points made", "XPM", "kicking"),
  xpa: raw("Extra point attempts", "XPA", "kicking"),
  xpBlocked: raw("Extra points blocked", "XPB", "kicking", { better: "lower" }),

  punts: raw("Punts", "PUNT", "punting"),
  puntYds: raw("Punt yards", "YDS", "punting"),
  puntLong: raw("Longest punt", "LNG", "punting", { aggregation: "max" }),
  puntIn20: raw("Punts inside 20", "IN20", "punting"),
  puntTouchbacks: raw("Touchbacks", "TB", "punting", { better: "lower" }),
  puntBlocked: raw("Punts blocked", "BLK", "punting", { better: "lower" }),

  kickReturns: raw("Kick returns", "KR", "returns"),
  kickReturnYds: raw("Kick return yards", "KRY", "returns"),
  kickReturnTd: raw("Kick return touchdowns", "KRTD", "returns"),
  kickReturnLong: raw("Longest kick return", "KRL", "returns", { aggregation: "max" }),
  puntReturns: raw("Punt returns", "PR", "returns"),
  puntReturnYds: raw("Punt return yards", "PRY", "returns"),
  puntReturnTd: raw("Punt return touchdowns", "PRTD", "returns"),
  puntReturnLong: raw("Longest punt return", "PRL", "returns", { aggregation: "max" }),
} as const satisfies Record<string, RawStatDef>;

export type RawStatKey = keyof typeof RAW_STATS;
/** One player's raw stats for one game, or summed over many. Missing keys mean zero / not recorded. */
export type StatLine = Partial<Record<RawStatKey, number>>;
export type DeriveContext = { games: number };

export type DerivedStatDef = BaseDef & {
  kind: "derived";
  dependsOn: readonly RawStatKey[];
  compute: (line: StatLine, ctx: DeriveContext) => number | null;
  /** A per-game rate: meaningful across games, just a copy of the total inside one box score. */
  perGame?: true;
};

const v = (line: StatLine, key: RawStatKey) => line[key] ?? 0;

const derived = (
  label: string,
  abbr: string,
  category: StatCategory,
  format: StatFormat,
  dependsOn: readonly RawStatKey[],
  compute: DerivedStatDef["compute"],
): DerivedStatDef => ({
  kind: "derived",
  label,
  abbr,
  category,
  format,
  better: "higher",
  dependsOn,
  compute,
});

const perGameStat = (label: string, category: StatCategory, total: RawStatKey): DerivedStatDef => ({
  ...derived(label, "Y/G", category, "decimal", [total], (s, ctx) => perGame(v(s, total), ctx.games)),
  perGame: true,
});

// Fantasy points score whatever a line recorded, so they list no inputs: a column wherever there
// are rows, and a defender's zero is a real score.
const fantasy = derived("Fantasy points (PPR)", "FPTS", "fantasy", "decimal", [], fantasyPoints);

export const DERIVED_STATS = {
  passCmpPct: derived("Completion percentage", "CMP%", "passing", "pct", ["passCmp", "passAtt"], (s) =>
    pct(v(s, "passCmp"), v(s, "passAtt")),
  ),
  passYpa: derived("Yards per attempt", "Y/A", "passing", "decimal", ["passYds", "passAtt"], (s) =>
    safeDiv(v(s, "passYds"), v(s, "passAtt")),
  ),
  passYpg: perGameStat("Passing yards per game", "passing", "passYds"),
  passRating: derived(
    "Passer rating",
    "RTG",
    "passing",
    "rating",
    ["passCmp", "passAtt", "passYds", "passTd", "passInt"],
    (s) =>
      passerRating({
        cmp: v(s, "passCmp"),
        att: v(s, "passAtt"),
        yds: v(s, "passYds"),
        td: v(s, "passTd"),
        int: v(s, "passInt"),
      }),
  ),
  rushAvg: derived("Yards per carry", "AVG", "rushing", "decimal", ["rushYds", "rushAtt"], (s) =>
    safeDiv(v(s, "rushYds"), v(s, "rushAtt")),
  ),
  rushYpg: perGameStat("Rushing yards per game", "rushing", "rushYds"),
  recAvg: derived("Yards per reception", "AVG", "receiving", "decimal", ["recYds", "rec"], (s) =>
    safeDiv(v(s, "recYds"), v(s, "rec")),
  ),
  recYpg: perGameStat("Receiving yards per game", "receiving", "recYds"),
  scrimmageYds: derived(
    "Scrimmage yards",
    "SCRM",
    "rushing",
    "int",
    ["rushYds", "recYds"],
    (s) => v(s, "rushYds") + v(s, "recYds"),
  ),
  scrimmageTd: derived(
    "Scrimmage touchdowns",
    "TD",
    "rushing",
    "int",
    ["rushTd", "recTd"],
    (s) => v(s, "rushTd") + v(s, "recTd"),
  ),
  fgPct: derived("Field goal percentage", "FG%", "kicking", "pct", ["fgm", "fga"], (s) =>
    pct(v(s, "fgm"), v(s, "fga")),
  ),
  xpPct: derived("Extra point percentage", "XP%", "kicking", "pct", ["xpm", "xpa"], (s) =>
    pct(v(s, "xpm"), v(s, "xpa")),
  ),
  puntAvg: derived("Yards per punt", "AVG", "punting", "decimal", ["puntYds", "punts"], (s) =>
    safeDiv(v(s, "puntYds"), v(s, "punts")),
  ),
  kickReturnAvg: derived(
    "Yards per kick return",
    "KRA",
    "returns",
    "decimal",
    ["kickReturnYds", "kickReturns"],
    (s) => safeDiv(v(s, "kickReturnYds"), v(s, "kickReturns")),
  ),
  puntReturnAvg: derived(
    "Yards per punt return",
    "PRA",
    "returns",
    "decimal",
    ["puntReturnYds", "puntReturns"],
    (s) => safeDiv(v(s, "puntReturnYds"), v(s, "puntReturns")),
  ),
  fantasyPts: fantasy,
  fantasyPpg: {
    ...derived("Fantasy points per game", "FP/G", "fantasy", "decimal", [], (s, ctx) => {
      const points = fantasyPoints(s);
      return points === null ? null : perGame(points, ctx.games);
    }),
    perGame: true,
  },
} as const satisfies Record<string, DerivedStatDef>;

export type DerivedStatKey = keyof typeof DERIVED_STATS;
export type StatKey = RawStatKey | DerivedStatKey;
export type StatDef = RawStatDef | DerivedStatDef;

export const STAT_REGISTRY: Record<StatKey, StatDef> = { ...RAW_STATS, ...DERIVED_STATS };

export const RAW_STAT_KEYS = Object.keys(RAW_STATS) as RawStatKey[];
export const STAT_KEYS = Object.keys(STAT_REGISTRY) as StatKey[];

export function isStatKey(key: string): key is StatKey {
  return key in STAT_REGISTRY;
}

export function isRawStatKey(key: string): key is RawStatKey {
  return key in RAW_STATS;
}

export function getStat(key: StatKey): StatDef {
  return STAT_REGISTRY[key];
}

/** All stats in a category, raw first then derived, in declaration order. */
export function statsInCategory(category: StatCategory): StatKey[] {
  return STAT_KEYS.filter((key) => STAT_REGISTRY[key].category === category);
}

/** The JSON field name extraction schemas use for a stat key (`passYds` → `pass_yds`). */
export function extractionField(key: string): string {
  return key
    .replace(/([A-Z])/g, "_$1")
    .replace(/(\d+)/g, "_$1")
    .toLowerCase()
    .replace(/__+/g, "_");
}

/**
 * The league team stat registry: every column of Madden's league team stats screen (NFL view,
 * one tab per R2 page), declared once, and what can be worked out from it. Raw stats are what
 * the screen prints as counts and totals; percentages, combined yards, points, differentials and
 * turnover margins are derived, so they always agree with the counts. Any count can also be read
 * per game. `leagueTeamStats.stats` is keyed by the raw keys. The tabs that lay these out are in
 * `leagueTeamTabs.ts`.
 */
import { pct, safeDiv } from "./math";
import type { StatFormat } from "./registry";

/** Regular-season games, the divisor when a team's games played are not known. */
export const SEASON_GAMES = 17;

type Base = {
  label: string;
  abbr: string;
  format: StatFormat;
  better: "higher" | "lower";
  /** Already a rate (points per game): never divided again in the per-game view. */
  rate?: true;
  /** The season total this per-game figure is (PPG of points), so the per-game view shows one. */
  perGameOf?: string;
};
export type LeagueTeamRawDef = Base & { kind: "raw"; hint: string };
/** `games` is the team's games played that season. */
export type LeagueTeamDerivedDef = Base & {
  kind: "derived";
  compute: (line: LeagueTeamLine, ctx: { games: number }) => number | null;
};

const raw = (
  label: string,
  abbr: string,
  hint: string,
  opts: Partial<Pick<Base, "format" | "better" | "rate" | "perGameOf">> = {},
): LeagueTeamRawDef => ({
  kind: "raw",
  label,
  abbr,
  hint,
  ...opts,
  format: opts.format ?? "int",
  better: opts.better ?? "higher",
});

export const LEAGUE_TEAM_RAW = {
  totalYds: raw("Total yards", "TOTAL", "Offense TOTAL column: all yards, returns included"),
  passYds: raw("Passing yards", "PASS", "Offense PASS column"),
  rushYds: raw("Rushing yards", "RUSH", "Offense RUSH column"),
  pointsPg: raw("Points per game", "PPG", "Offense PPG column", {
    format: "decimal",
    rate: true,
    perGameOf: "pointsFor",
  }),
  passTd: raw("Passing touchdowns", "PTD", "Offense PTD column"),
  rushTd: raw("Rushing touchdowns", "RTD", "Offense RTD column"),
  firstDowns: raw("First downs", "1ST", "Offense 1ST DOWNS column"),

  passYdsAllowed: raw("Passing yards allowed", "PASS", "Defense PASS column", { better: "lower" }),
  rushYdsAllowed: raw("Rushing yards allowed", "RUSH", "Defense RUSH column", { better: "lower" }),
  pointsAllowed: raw("Points allowed", "PTS", "Defense PTS column", { better: "lower" }),
  sacks: raw("Sacks", "SACK", "Defense SACK column"),
  fumblesRecovered: raw("Fumbles recovered", "FUM REC", "Defense FUM column, Turnovers FUM REC column"),
  defInt: raw(
    "Interceptions",
    "D INT",
    "Defense INT column, Turnovers D INT column: passes the defense picked off",
  ),

  thirdDownConv: raw("Third downs converted", "3DC", "Conversions 3DC column"),
  thirdDownAtt: raw("Third down attempts", "3DA", "Conversions 3DA column"),
  fourthDownConv: raw("Fourth downs converted", "4DC", "Conversions 4DC column"),
  fourthDownAtt: raw("Fourth down attempts", "4DA", "Conversions 4DA column"),
  twoPtConv: raw("Two-point conversions", "2PC", "Conversions 2PC column"),
  twoPtAtt: raw("Two-point attempts", "2PA", "Conversions 2PA column"),

  redZoneAtt: raw("Red zone trips", "ATT", "Redzone Efficiency ATT column"),
  redZoneTd: raw("Red zone touchdowns", "TD", "Redzone Efficiency TD column"),
  redZoneFg: raw("Red zone field goals", "FG", "Redzone Efficiency FG column"),
  redZoneDefAtt: raw("Opponent red zone trips", "DATT", "Redzone Efficiency DATT column", {
    better: "lower",
  }),
  redZoneDefTd: raw("Opponent red zone touchdowns", "DTD", "Redzone Efficiency DTD column", {
    better: "lower",
  }),
  redZoneDefFg: raw("Opponent red zone field goals", "DFG", "Redzone Efficiency DFG column", {
    better: "lower",
  }),

  intThrown: raw("Interceptions thrown", "INT", "Turnovers INT column: passes the offense threw away", {
    better: "lower",
  }),
  fumblesLost: raw("Fumbles lost", "FUM LOST", "Turnovers FUM LOST column", { better: "lower" }),
} as const satisfies Record<string, LeagueTeamRawDef>;

export type LeagueTeamRawKey = keyof typeof LEAGUE_TEAM_RAW;
export type LeagueTeamLine = Partial<Record<LeagueTeamRawKey, number>>;

/** A value only when every input was recorded, so a missing tab never reads as zero. */
const all =
  (keys: readonly LeagueTeamRawKey[], f: (n: (k: LeagueTeamRawKey) => number) => number | null) =>
  (line: LeagueTeamLine) => (keys.every((k) => line[k] !== undefined) ? f((k) => line[k] ?? 0) : null);

const derived = (
  label: string,
  abbr: string,
  format: StatFormat,
  compute: LeagueTeamDerivedDef["compute"],
  opts: Partial<Pick<Base, "better" | "rate" | "perGameOf">> = {},
): LeagueTeamDerivedDef => ({
  kind: "derived",
  label,
  abbr,
  format,
  compute,
  ...opts,
  better: opts.better ?? "higher",
});

const rate = (made: LeagueTeamRawKey, att: LeagueTeamRawKey) => all([made, att], (n) => pct(n(made), n(att)));
const lower = { better: "lower" } as const;

/** Season points from points per game: Madden prints only the average, to one decimal. */
const pointsFor = (line: LeagueTeamLine, games: number) =>
  line.pointsPg === undefined ? null : Math.round(line.pointsPg * games);
const offYds = all(["passYds", "rushYds"], (n) => n("passYds") + n("rushYds"));
const yardsAllowed = all(
  ["passYdsAllowed", "rushYdsAllowed"],
  (n) => n("passYdsAllowed") + n("rushYdsAllowed"),
);

export const LEAGUE_TEAM_DERIVED = {
  offYds: derived("Offensive yards", "OFF", "int", offYds),
  returnYds: derived(
    "Return yards",
    "RET",
    "int",
    all(["totalYds", "passYds", "rushYds"], (n) => n("totalYds") - n("passYds") - n("rushYds")),
  ),
  pointsFor: derived("Points scored", "PTS", "int", (line, { games }) => pointsFor(line, games)),
  totalTd: derived(
    "Offensive touchdowns",
    "TD",
    "int",
    all(["passTd", "rushTd"], (n) => n("passTd") + n("rushTd")),
  ),
  yardsAllowed: derived("Yards allowed", "TOTAL", "int", yardsAllowed, lower),
  pointsAllowedPg: derived(
    "Points allowed per game",
    "OPPG",
    "decimal",
    (line, { games }) => (line.pointsAllowed === undefined ? null : safeDiv(line.pointsAllowed, games)),
    { ...lower, rate: true, perGameOf: "pointsAllowed" },
  ),
  pointDiff: derived("Point differential", "PT DIFF", "int", (line, { games }) => {
    const scored = pointsFor(line, games);
    return scored === null || line.pointsAllowed === undefined ? null : scored - line.pointsAllowed;
  }),
  yardsDiff: derived("Yard differential", "YD DIFF", "int", (line) => {
    const gained = offYds(line);
    const allowed = yardsAllowed(line);
    return gained === null || allowed === null ? null : gained - allowed;
  }),
  thirdDownPct: derived("Third down conversion %", "3D%", "pct", rate("thirdDownConv", "thirdDownAtt")),
  fourthDownPct: derived("Fourth down conversion %", "4D%", "pct", rate("fourthDownConv", "fourthDownAtt")),
  twoPtPct: derived("Two-point conversion %", "2P%", "pct", rate("twoPtConv", "twoPtAtt")),
  redZonePct: derived("Red zone touchdown %", "OFF%", "pct", rate("redZoneTd", "redZoneAtt")),
  redZoneScorePct: derived(
    "Red zone scoring %",
    "SCR%",
    "pct",
    all(["redZoneTd", "redZoneFg", "redZoneAtt"], (n) =>
      pct(n("redZoneTd") + n("redZoneFg"), n("redZoneAtt")),
    ),
  ),
  redZoneDefPct: derived(
    "Opponent red zone touchdown %",
    "DEF%",
    "pct",
    rate("redZoneDefTd", "redZoneDefAtt"),
    lower,
  ),
  redZoneDefScorePct: derived(
    "Opponent red zone scoring %",
    "DSCR%",
    "pct",
    all(["redZoneDefTd", "redZoneDefFg", "redZoneDefAtt"], (n) =>
      pct(n("redZoneDefTd") + n("redZoneDefFg"), n("redZoneDefAtt")),
    ),
    lower,
  ),
  giveaways: derived(
    "Giveaways",
    "GIVE",
    "int",
    all(["intThrown", "fumblesLost"], (n) => n("intThrown") + n("fumblesLost")),
    lower,
  ),
  takeaways: derived(
    "Takeaways",
    "TAKE",
    "int",
    all(["defInt", "fumblesRecovered"], (n) => n("defInt") + n("fumblesRecovered")),
  ),
  turnoverDiff: derived(
    "Turnover differential",
    "DIFF",
    "int",
    all(
      ["defInt", "fumblesRecovered", "intThrown", "fumblesLost"],
      (n) => n("defInt") + n("fumblesRecovered") - n("intThrown") - n("fumblesLost"),
    ),
  ),
} as const satisfies Record<string, LeagueTeamDerivedDef>;

export type LeagueTeamStatKey = LeagueTeamRawKey | keyof typeof LEAGUE_TEAM_DERIVED;
export const LEAGUE_TEAM_STATS: Record<LeagueTeamStatKey, LeagueTeamRawDef | LeagueTeamDerivedDef> = {
  ...LEAGUE_TEAM_RAW,
  ...LEAGUE_TEAM_DERIVED,
};
export const LEAGUE_TEAM_RAW_KEYS = Object.keys(LEAGUE_TEAM_RAW) as LeagueTeamRawKey[];

export function isLeagueTeamRawKey(key: string): key is LeagueTeamRawKey {
  return key in LEAGUE_TEAM_RAW;
}

/** Percentages and per-game figures read the same in either view. */
export function isLeagueTeamRate(key: LeagueTeamStatKey): boolean {
  const def = LEAGUE_TEAM_STATS[key];
  return def.format === "pct" || def.rate === true;
}

/** A stat's value for a team's season, or per game played when `perGame` (rates stay as they are). */
export function leagueTeamValue(
  key: LeagueTeamStatKey,
  line: LeagueTeamLine,
  ctx: { games: number },
  perGame = false,
): number | null {
  const value = isLeagueTeamRawKey(key) ? (line[key] ?? null) : LEAGUE_TEAM_DERIVED[key].compute(line, ctx);
  return !perGame || value === null || isLeagueTeamRate(key) ? value : safeDiv(value, ctx.games);
}

/** How a column reads: the stat itself, or its per-game form ("PASS/G", one decimal). */
export function leagueTeamColumnDef(key: LeagueTeamStatKey, perGame: boolean) {
  const def = LEAGUE_TEAM_STATS[key];
  if (!perGame || isLeagueTeamRate(key)) return def;
  return { ...def, abbr: `${def.abbr}/G`, label: `${def.label} per game`, format: "decimal" as const };
}

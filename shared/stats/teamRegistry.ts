/**
 * The team game stat registry: everything Madden's post-game team stats screen shows, declared
 * once. `gameTeamStats.stats` is keyed by these keys; the comparison rows on game detail, the
 * extraction schema for the team stats target and later team season stats all read from here.
 */

/** int: 1,234 · time: 31:42 (stored as seconds) */
export type TeamStatFormat = "int" | "time";

export type TeamStatDef = {
  label: string;
  format: TeamStatFormat;
  better: "higher" | "lower";
};

const stat = (label: string, opts: Partial<Omit<TeamStatDef, "label">> = {}): TeamStatDef => ({
  label,
  format: opts.format ?? "int",
  better: opts.better ?? "higher",
});

export const TEAM_STATS = {
  firstDowns: stat("First downs"),
  plays: stat("Total plays"),
  totalYds: stat("Total yards"),
  passYds: stat("Passing yards"),
  passCmp: stat("Completions"),
  passAtt: stat("Pass attempts"),
  rushYds: stat("Rushing yards"),
  rushAtt: stat("Rush attempts"),
  thirdDownConv: stat("Third downs converted"),
  thirdDownAtt: stat("Third down attempts"),
  fourthDownConv: stat("Fourth downs converted"),
  fourthDownAtt: stat("Fourth down attempts"),
  twoPtConv: stat("Two-point conversions"),
  twoPtAtt: stat("Two-point attempts"),
  redZoneTd: stat("Red zone touchdowns"),
  redZoneFg: stat("Red zone field goals"),
  redZoneAtt: stat("Red zone trips"),
  turnovers: stat("Turnovers", { better: "lower" }),
  fumblesLost: stat("Fumbles lost", { better: "lower" }),
  intThrown: stat("Interceptions thrown", { better: "lower" }),
  sacksAllowed: stat("Sacks allowed", { better: "lower" }),
  penalties: stat("Penalties", { better: "lower" }),
  penaltyYds: stat("Penalty yards", { better: "lower" }),
  possessionSec: stat("Time of possession", { format: "time" }),
} as const satisfies Record<string, TeamStatDef>;

export type TeamStatKey = keyof typeof TEAM_STATS;
export type TeamStatLine = Partial<Record<TeamStatKey, number>>;
export const TEAM_STAT_KEYS = Object.keys(TEAM_STATS) as TeamStatKey[];

export function isTeamStatKey(key: string): key is TeamStatKey {
  return key in TEAM_STATS;
}

/**
 * A row in the side-by-side comparison: one stat, or a made/attempted pair shown as "5/12".
 * Ordered the way the Madden screen lists them.
 */
export type TeamStatRow = { id: string; label: string; keys: [TeamStatKey] | [TeamStatKey, TeamStatKey] };

export const TEAM_STAT_ROWS: readonly TeamStatRow[] = [
  { id: "firstDowns", label: "First downs", keys: ["firstDowns"] },
  { id: "totalYds", label: "Total yards", keys: ["totalYds"] },
  { id: "plays", label: "Plays", keys: ["plays"] },
  { id: "passYds", label: "Passing yards", keys: ["passYds"] },
  { id: "passing", label: "Comp / att", keys: ["passCmp", "passAtt"] },
  { id: "rushYds", label: "Rushing yards", keys: ["rushYds"] },
  { id: "rushAtt", label: "Rush attempts", keys: ["rushAtt"] },
  { id: "thirdDown", label: "Third down", keys: ["thirdDownConv", "thirdDownAtt"] },
  { id: "fourthDown", label: "Fourth down", keys: ["fourthDownConv", "fourthDownAtt"] },
  { id: "twoPt", label: "Two-point", keys: ["twoPtConv", "twoPtAtt"] },
  { id: "redZone", label: "Red zone TD", keys: ["redZoneTd", "redZoneAtt"] },
  { id: "redZoneFg", label: "Red zone FG", keys: ["redZoneFg"] },
  { id: "turnovers", label: "Turnovers", keys: ["turnovers"] },
  { id: "fumblesLost", label: "Fumbles lost", keys: ["fumblesLost"] },
  { id: "intThrown", label: "Interceptions", keys: ["intThrown"] },
  { id: "sacksAllowed", label: "Sacks allowed", keys: ["sacksAllowed"] },
  { id: "penalties", label: "Penalties", keys: ["penalties", "penaltyYds"] },
  { id: "possessionSec", label: "Possession", keys: ["possessionSec"] },
];

/** The number a comparison bar is sized by: the single value, or the made count of a pair. */
export function rowValue(row: TeamStatRow, line: TeamStatLine): number | null {
  return line[row.keys[0]] ?? null;
}

export function formatTeamStat(key: TeamStatKey, value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (TEAM_STATS[key].format === "time") {
    const minutes = Math.floor(value / 60);
    return `${minutes}:${String(Math.round(value % 60)).padStart(2, "0")}`;
  }
  return value.toLocaleString("en-US");
}

/** "5/12", "6-45" for penalties, or a single formatted value. */
export function formatTeamRow(row: TeamStatRow, line: TeamStatLine): string {
  const [first, second] = row.keys;
  if (second === undefined) return formatTeamStat(first, line[first]);
  const separator = row.id === "penalties" ? "-" : "/";
  return `${formatTeamStat(first, line[first])}${separator}${formatTeamStat(second, line[second])}`;
}

/** Parses "31:42" or "1902" into seconds; null when neither. */
export function parseClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

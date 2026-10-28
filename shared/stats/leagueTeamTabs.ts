/**
 * How the league team stats table lays the registry out: Madden's five tabs in screen order,
 * which are also what a capture reads, plus an overview of the numbers that sum a season up.
 */
import {
  isLeagueTeamRawKey,
  LEAGUE_TEAM_STATS,
  type LeagueTeamRawKey,
  type LeagueTeamStatKey,
} from "./leagueTeamRegistry";

/** The tabs of Madden's screen (R2), in order. */
export const LEAGUE_TEAM_SCREEN_TABS = ["offense", "defense", "conversions", "redZone", "turnovers"] as const;
export type LeagueTeamScreenTab = (typeof LEAGUE_TEAM_SCREEN_TABS)[number];
export const LEAGUE_TEAM_TABS = ["overview", ...LEAGUE_TEAM_SCREEN_TABS] as const;
export type LeagueTeamTab = (typeof LEAGUE_TEAM_TABS)[number];

type TabDef = {
  label: string;
  /** Madden's columns in screen order, then what the app works out from them. */
  columns: readonly LeagueTeamStatKey[];
  /** Kept in the phone table; the rest go in the tap-to-expand card. */
  phone: readonly LeagueTeamStatKey[];
  /** The column the table sorts by first. */
  lead: LeagueTeamStatKey;
};

export const LEAGUE_TEAM_TAB_DEFS: Record<LeagueTeamTab, TabDef> = {
  overview: {
    label: "Overview",
    columns: [
      "pointsPg",
      "pointsAllowedPg",
      "pointDiff",
      "offYds",
      "yardsAllowed",
      "yardsDiff",
      "turnoverDiff",
      "thirdDownPct",
      "redZonePct",
      "redZoneDefPct",
    ],
    phone: ["pointsPg", "pointsAllowedPg", "pointDiff"],
    lead: "pointDiff",
  },
  offense: {
    label: "Offense",
    columns: [
      "totalYds",
      "offYds",
      "passYds",
      "rushYds",
      "pointsPg",
      "passTd",
      "rushTd",
      "firstDowns",
      "pointsFor",
      "totalTd",
      "returnYds",
    ],
    phone: ["offYds", "pointsPg"],
    lead: "offYds",
  },
  defense: {
    label: "Defense",
    columns: [
      "yardsAllowed",
      "passYdsAllowed",
      "rushYdsAllowed",
      "pointsAllowed",
      "pointsAllowedPg",
      "sacks",
      "fumblesRecovered",
      "defInt",
    ],
    phone: ["yardsAllowed", "pointsAllowedPg"],
    lead: "yardsAllowed",
  },
  conversions: {
    label: "Conversions",
    columns: [
      "thirdDownConv",
      "thirdDownAtt",
      "thirdDownPct",
      "fourthDownConv",
      "fourthDownAtt",
      "fourthDownPct",
      "twoPtConv",
      "twoPtAtt",
      "twoPtPct",
    ],
    phone: ["thirdDownPct", "fourthDownPct"],
    lead: "thirdDownPct",
  },
  redZone: {
    label: "Red zone",
    columns: [
      "redZoneAtt",
      "redZoneTd",
      "redZoneFg",
      "redZonePct",
      "redZoneScorePct",
      "redZoneDefAtt",
      "redZoneDefTd",
      "redZoneDefFg",
      "redZoneDefPct",
      "redZoneDefScorePct",
    ],
    phone: ["redZonePct", "redZoneDefPct"],
    lead: "redZonePct",
  },
  turnovers: {
    label: "Turnovers",
    columns: [
      "turnoverDiff",
      "giveaways",
      "intThrown",
      "fumblesLost",
      "takeaways",
      "defInt",
      "fumblesRecovered",
    ],
    phone: ["turnoverDiff", "takeaways", "giveaways"],
    lead: "turnoverDiff",
  },
};

/**
 * A tab's columns in the totals or the per-game view. Per game, a season total whose per-game
 * figure is already in the tab (points allowed beside OPPG) is left out rather than shown twice.
 */
export function leagueTeamColumns(tab: LeagueTeamTab, perGame: boolean): LeagueTeamStatKey[] {
  const { columns } = LEAGUE_TEAM_TAB_DEFS[tab];
  if (!perGame) return [...columns];
  const twins = new Set(columns.flatMap((k) => LEAGUE_TEAM_STATS[k].perGameOf ?? []));
  return columns.filter((k) => !twins.has(k));
}

/** The raw stats a tab's screen prints, for its extraction schema. */
export function rawKeysInTab(tab: LeagueTeamScreenTab): LeagueTeamRawKey[] {
  return LEAGUE_TEAM_TAB_DEFS[tab].columns.filter(isLeagueTeamRawKey);
}

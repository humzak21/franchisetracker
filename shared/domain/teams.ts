/**
 * The 32 NFL teams with divisions, colors and ESPN ids. Seed source for the
 * `teams` table and fixture source for the component gallery.
 */

export const CONFERENCES = ["AFC", "NFC"] as const;
export type Conference = (typeof CONFERENCES)[number];

export const DIVISIONS = ["East", "North", "South", "West"] as const;
export type Division = (typeof DIVISIONS)[number];

export type TeamSeed = {
  abbr: string;
  city: string;
  name: string;
  conference: Conference;
  division: Division;
  primaryColor: string;
  secondaryColor: string;
  espnId: number;
};

// One team per line reads as a table; keep it that way.
// prettier-ignore
export const NFL_TEAMS: readonly TeamSeed[] = [
  { abbr: "BUF", city: "Buffalo", name: "Bills", conference: "AFC", division: "East", primaryColor: "#00338D", secondaryColor: "#C60C30", espnId: 2 },
  { abbr: "MIA", city: "Miami", name: "Dolphins", conference: "AFC", division: "East", primaryColor: "#008E97", secondaryColor: "#FC4C02", espnId: 15 },
  { abbr: "NE", city: "New England", name: "Patriots", conference: "AFC", division: "East", primaryColor: "#002244", secondaryColor: "#C60C30", espnId: 17 },
  { abbr: "NYJ", city: "New York", name: "Jets", conference: "AFC", division: "East", primaryColor: "#125740", secondaryColor: "#FFFFFF", espnId: 20 },
  { abbr: "BAL", city: "Baltimore", name: "Ravens", conference: "AFC", division: "North", primaryColor: "#241773", secondaryColor: "#9E7C0C", espnId: 33 },
  { abbr: "CIN", city: "Cincinnati", name: "Bengals", conference: "AFC", division: "North", primaryColor: "#FB4F14", secondaryColor: "#000000", espnId: 4 },
  { abbr: "CLE", city: "Cleveland", name: "Browns", conference: "AFC", division: "North", primaryColor: "#311D00", secondaryColor: "#FF3C00", espnId: 5 },
  { abbr: "PIT", city: "Pittsburgh", name: "Steelers", conference: "AFC", division: "North", primaryColor: "#FFB612", secondaryColor: "#101820", espnId: 23 },
  { abbr: "HOU", city: "Houston", name: "Texans", conference: "AFC", division: "South", primaryColor: "#03202F", secondaryColor: "#A71930", espnId: 34 },
  { abbr: "IND", city: "Indianapolis", name: "Colts", conference: "AFC", division: "South", primaryColor: "#002C5F", secondaryColor: "#A2AAAD", espnId: 11 },
  { abbr: "JAX", city: "Jacksonville", name: "Jaguars", conference: "AFC", division: "South", primaryColor: "#006778", secondaryColor: "#D7A22A", espnId: 30 },
  { abbr: "TEN", city: "Tennessee", name: "Titans", conference: "AFC", division: "South", primaryColor: "#0C2340", secondaryColor: "#4B92DB", espnId: 10 },
  { abbr: "DEN", city: "Denver", name: "Broncos", conference: "AFC", division: "West", primaryColor: "#FB4F14", secondaryColor: "#002244", espnId: 7 },
  { abbr: "KC", city: "Kansas City", name: "Chiefs", conference: "AFC", division: "West", primaryColor: "#E31837", secondaryColor: "#FFB81C", espnId: 12 },
  { abbr: "LV", city: "Las Vegas", name: "Raiders", conference: "AFC", division: "West", primaryColor: "#000000", secondaryColor: "#A5ACAF", espnId: 13 },
  { abbr: "LAC", city: "Los Angeles", name: "Chargers", conference: "AFC", division: "West", primaryColor: "#0080C6", secondaryColor: "#FFC20E", espnId: 24 },
  { abbr: "DAL", city: "Dallas", name: "Cowboys", conference: "NFC", division: "East", primaryColor: "#003594", secondaryColor: "#869397", espnId: 6 },
  { abbr: "NYG", city: "New York", name: "Giants", conference: "NFC", division: "East", primaryColor: "#0B2265", secondaryColor: "#A71930", espnId: 19 },
  { abbr: "PHI", city: "Philadelphia", name: "Eagles", conference: "NFC", division: "East", primaryColor: "#004C54", secondaryColor: "#A5ACAF", espnId: 21 },
  { abbr: "WAS", city: "Washington", name: "Commanders", conference: "NFC", division: "East", primaryColor: "#5A1414", secondaryColor: "#FFB612", espnId: 28 },
  { abbr: "CHI", city: "Chicago", name: "Bears", conference: "NFC", division: "North", primaryColor: "#0B162A", secondaryColor: "#C83803", espnId: 3 },
  { abbr: "DET", city: "Detroit", name: "Lions", conference: "NFC", division: "North", primaryColor: "#0076B6", secondaryColor: "#B0B7BC", espnId: 8 },
  { abbr: "GB", city: "Green Bay", name: "Packers", conference: "NFC", division: "North", primaryColor: "#203731", secondaryColor: "#FFB612", espnId: 9 },
  { abbr: "MIN", city: "Minnesota", name: "Vikings", conference: "NFC", division: "North", primaryColor: "#4F2683", secondaryColor: "#FFC62F", espnId: 16 },
  { abbr: "ATL", city: "Atlanta", name: "Falcons", conference: "NFC", division: "South", primaryColor: "#A71930", secondaryColor: "#000000", espnId: 1 },
  { abbr: "CAR", city: "Carolina", name: "Panthers", conference: "NFC", division: "South", primaryColor: "#0085CA", secondaryColor: "#101820", espnId: 29 },
  { abbr: "NO", city: "New Orleans", name: "Saints", conference: "NFC", division: "South", primaryColor: "#D3BC8D", secondaryColor: "#101820", espnId: 18 },
  { abbr: "TB", city: "Tampa Bay", name: "Buccaneers", conference: "NFC", division: "South", primaryColor: "#D50A0A", secondaryColor: "#34302B", espnId: 27 },
  { abbr: "ARI", city: "Arizona", name: "Cardinals", conference: "NFC", division: "West", primaryColor: "#97233F", secondaryColor: "#000000", espnId: 22 },
  { abbr: "LAR", city: "Los Angeles", name: "Rams", conference: "NFC", division: "West", primaryColor: "#003594", secondaryColor: "#FFA300", espnId: 14 },
  { abbr: "SF", city: "San Francisco", name: "49ers", conference: "NFC", division: "West", primaryColor: "#AA0000", secondaryColor: "#B3995D", espnId: 25 },
  { abbr: "SEA", city: "Seattle", name: "Seahawks", conference: "NFC", division: "West", primaryColor: "#002244", secondaryColor: "#69BE28", espnId: 26 },
];

export function findTeamSeed(abbr: string): TeamSeed | undefined {
  return NFL_TEAMS.find((team) => team.abbr === abbr.toUpperCase());
}

/** Abbreviations other sources (and older Madden screens) use for the same franchises. */
const TEAM_ABBR_ALIASES: Record<string, string> = {
  JAC: "JAX",
  WSH: "WAS",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
  LA: "LAR",
  ARZ: "ARI",
  GNB: "GB",
  KAN: "KC",
  NWE: "NE",
  NOR: "NO",
  SFO: "SF",
  TAM: "TB",
};

/**
 * Resolves a team as printed on a screenshot ("NE", "Patriots", "New England Patriots",
 * "OAK") to its abbreviation, or null. A bare city shared by two teams ("New York") is null.
 */
export function resolveTeamAbbr(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/\s+/g, " ");
  const upper = cleaned.toUpperCase();
  if (findTeamSeed(upper)) return upper;
  if (TEAM_ABBR_ALIASES[upper]) return TEAM_ABBR_ALIASES[upper];
  const lower = cleaned.toLowerCase();
  const byName = NFL_TEAMS.filter(
    (t) =>
      lower === t.name.toLowerCase() ||
      lower === `${t.city} ${t.name}`.toLowerCase() ||
      lower.endsWith(` ${t.name.toLowerCase()}`),
  );
  if (byName.length === 1) return byName[0]!.abbr;
  const byCity = NFL_TEAMS.filter((t) => lower === t.city.toLowerCase());
  return byCity.length === 1 ? byCity[0]!.abbr : null;
}

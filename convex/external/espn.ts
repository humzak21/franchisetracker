/**
 * The unofficial ESPN site API: player search, athlete bios, headshots and team logos, for the
 * NFL and college football. Plain `fetch`, so it runs in either Convex runtime. No key; responses
 * are narrowed field by field. An athlete keeps one id from college into the NFL.
 */
import { ESPN_LEAGUE_SLUGS, type EspnLeague } from "../../shared/players/espnMatch";

const SEARCH = "https://site.web.api.espn.com/apis/common/v3/search";
const ATHLETES = "https://site.web.api.espn.com/apis/common/v3/sports/football";
const TIMEOUT_MS = 20_000;

export const espnHeadshotUrl = (espnId: number, league: EspnLeague = "nfl") =>
  `https://a.espncdn.com/i/headshots/${ESPN_LEAGUE_SLUGS[league]}/players/full/${espnId}.png`;
export const espnLogoUrl = (abbr: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;

const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

/** An image as a Blob, or null when ESPN has none (404). */
export async function fetchImage(url: string): Promise<Blob | null> {
  const res = await get(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ESPN image ${res.status}`);
  const blob = await res.blob();
  return blob.type.startsWith("image/") ? blob : null;
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export type EspnCandidate = { espnId: number; name: string };

/** Up to `limit` players in one league whose name matches. */
export async function searchAthletes(name: string, league: EspnLeague, limit = 8): Promise<EspnCandidate[]> {
  const params = new URLSearchParams({
    query: name,
    limit: String(limit),
    type: "player",
    sport: "football",
    league: ESPN_LEAGUE_SLUGS[league],
  });
  const res = await get(`${SEARCH}?${params}`);
  if (!res.ok) throw new Error(`ESPN search ${res.status}`);
  const items = record(await res.json()).items;
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    const espnId = Number(record(item).id);
    const name = str(record(item).displayName);
    return Number.isInteger(espnId) && name ? [{ espnId, name }] : [];
  });
}

export type EspnAthlete = {
  espnId: number;
  league: EspnLeague;
  name: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  /** NFL team, or the school for a college player. */
  teamAbbr?: string;
  /** The college attended (NFL) or attending (college). */
  college?: string;
  /** College class as ESPN prints it ("Junior", "Senior"); college players only. */
  classYear?: string;
  heightIn?: number;
  weightLb?: number;
  age?: number;
  hasHeadshot: boolean;
};

/** "6' 4\"" → 76. */
function inches(display: string | undefined): number | undefined {
  const match = display?.match(/(\d+)'\s*(\d+)/);
  return match ? Number(match[1]) * 12 + Number(match[2]) : undefined;
}

/** An athlete's bio in one league, or null when ESPN does not know the id there. */
export async function fetchAthlete(espnId: number, league: EspnLeague): Promise<EspnAthlete | null> {
  const res = await get(`${ATHLETES}/${ESPN_LEAGUE_SLUGS[league]}/athletes/${espnId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ESPN athlete ${res.status}`);
  const a = record(record(await res.json()).athlete);
  const name = str(a.displayName);
  if (!name) return null;
  const weight = Number.parseInt(str(a.displayWeight) ?? "", 10);
  const team = record(a.team);
  return {
    espnId,
    league,
    name,
    firstName: str(a.firstName),
    lastName: str(a.lastName),
    position: str(record(a.position).abbreviation),
    teamAbbr: str(team.abbreviation),
    college: str(record(a.college).name) ?? (league === "college" ? str(team.location) : undefined),
    classYear: league === "college" ? str(a.displayExperience) : undefined,
    heightIn: inches(str(a.displayHeight)),
    weightLb: Number.isFinite(weight) ? weight : undefined,
    age: typeof a.age === "number" ? a.age : undefined,
    hasHeadshot: str(record(a.headshot).href) !== undefined,
  };
}

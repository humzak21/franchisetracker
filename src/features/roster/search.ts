/** Whose roster the screen opens on: another team's by abbreviation, or the user team's. */
export type RosterSearch = { team?: string };

export function parseRosterSearch(search: Record<string, unknown>): RosterSearch {
  return typeof search.team === "string" && search.team !== "" ? { team: search.team } : {};
}

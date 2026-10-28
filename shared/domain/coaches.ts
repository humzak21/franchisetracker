/**
 * The bank of NFL head coaches for Coach of the Year (FEATURES.md 5.8): everyone who has been a
 * head coach since 2015, interim coaches included, with the teams they coached. Coaches matter
 * nowhere else, so this is a name list rather than a table; created coaches add to it per franchise.
 */

export type BankCoach = { name: string; teams: readonly string[] };

// One coach per line reads as a table; keep it that way.
// prettier-ignore
export const NFL_HEAD_COACHES: readonly BankCoach[] = [
  { name: "Aaron Glenn", teams: ["NYJ"] },
  { name: "Adam Gase", teams: ["MIA", "NYJ"] },
  { name: "Andy Reid", teams: ["KC"] },
  { name: "Anthony Lynn", teams: ["BUF", "LAC"] },
  { name: "Antonio Pierce", teams: ["LV"] },
  { name: "Arthur Smith", teams: ["ATL"] },
  { name: "Ben Johnson", teams: ["CHI"] },
  { name: "Ben McAdoo", teams: ["NYG"] },
  { name: "Bill Belichick", teams: ["NE"] },
  { name: "Bill Callahan", teams: ["WAS"] },
  { name: "Bill O'Brien", teams: ["HOU"] },
  { name: "Brandon Staley", teams: ["LAC"] },
  { name: "Brian Callahan", teams: ["TEN"] },
  { name: "Brian Daboll", teams: ["NYG"] },
  { name: "Brian Flores", teams: ["MIA"] },
  { name: "Brian Schottenheimer", teams: ["DAL"] },
  { name: "Bruce Arians", teams: ["ARI", "TB"] },
  { name: "Chip Kelly", teams: ["PHI", "SF"] },
  { name: "Chris Tabor", teams: ["CAR"] },
  { name: "Chuck Pagano", teams: ["IND"] },
  { name: "Dan Campbell", teams: ["MIA", "DET"] },
  { name: "Dan Quinn", teams: ["ATL", "WAS"] },
  { name: "Darrell Bevell", teams: ["DET", "JAX"] },
  { name: "Darren Rizzi", teams: ["NO"] },
  { name: "Dave Canales", teams: ["CAR"] },
  { name: "David Culley", teams: ["HOU"] },
  { name: "DeMeco Ryans", teams: ["HOU"] },
  { name: "Dennis Allen", teams: ["NO"] },
  { name: "Dirk Koetter", teams: ["TB"] },
  { name: "Doug Marrone", teams: ["JAX"] },
  { name: "Doug Pederson", teams: ["PHI", "JAX"] },
  { name: "Frank Reich", teams: ["IND", "CAR"] },
  { name: "Freddie Kitchens", teams: ["CLE"] },
  { name: "Gary Kubiak", teams: ["DEN"] },
  { name: "Giff Smith", teams: ["LAC"] },
  { name: "Gregg Williams", teams: ["CLE"] },
  { name: "Gus Bradley", teams: ["JAX"] },
  { name: "Hue Jackson", teams: ["CLE"] },
  { name: "Jack Del Rio", teams: ["LV"] },
  { name: "Jason Garrett", teams: ["DAL"] },
  { name: "Jay Gruden", teams: ["WAS"] },
  { name: "Jeff Fisher", teams: ["LAR"] },
  { name: "Jeff Hafley", teams: ["MIA"] },
  { name: "Jeff Saturday", teams: ["IND"] },
  { name: "Jeff Ulbrich", teams: ["NYJ"] },
  { name: "Jerod Mayo", teams: ["NE"] },
  { name: "Jerry Rosburg", teams: ["DEN"] },
  { name: "Jesse Minter", teams: ["BAL"] },
  { name: "Jim Caldwell", teams: ["DET"] },
  { name: "Jim Harbaugh", teams: ["LAC"] },
  { name: "Jim Tomsula", teams: ["SF"] },
  { name: "Joe Brady", teams: ["BUF"] },
  { name: "Joe Judge", teams: ["NYG"] },
  { name: "Joe Philbin", teams: ["MIA", "GB"] },
  { name: "John Fassel", teams: ["LAR"] },
  { name: "John Fox", teams: ["CHI"] },
  { name: "John Harbaugh", teams: ["BAL", "NYG"] },
  { name: "Jon Gruden", teams: ["LV"] },
  { name: "Jonathan Gannon", teams: ["ARI"] },
  { name: "Josh McDaniels", teams: ["LV"] },
  { name: "Kellen Moore", teams: ["NO"] },
  { name: "Ken Whisenhunt", teams: ["TEN"] },
  { name: "Kevin O'Connell", teams: ["MIN"] },
  { name: "Kevin Stefanski", teams: ["CLE", "ATL"] },
  { name: "Klint Kubiak", teams: ["LV"] },
  { name: "Kliff Kingsbury", teams: ["ARI"] },
  { name: "Kyle Shanahan", teams: ["SF"] },
  { name: "Liam Coen", teams: ["JAX"] },
  { name: "Lovie Smith", teams: ["TB", "HOU"] },
  { name: "Marvin Lewis", teams: ["CIN"] },
  { name: "Matt Eberflus", teams: ["CHI"] },
  { name: "Matt LaFleur", teams: ["GB"] },
  { name: "Matt Nagy", teams: ["CHI"] },
  { name: "Matt Patricia", teams: ["DET"] },
  { name: "Matt Rhule", teams: ["CAR"] },
  { name: "Mike Kafka", teams: ["NYG"] },
  { name: "Mike LaFleur", teams: ["ARI"] },
  { name: "Mike Macdonald", teams: ["SEA"] },
  { name: "Mike McCarthy", teams: ["GB", "DAL", "PIT"] },
  { name: "Mike McCoy", teams: ["LAC", "TEN"] },
  { name: "Mike McDaniel", teams: ["MIA"] },
  { name: "Mike Mularkey", teams: ["TEN"] },
  { name: "Mike Pettine", teams: ["CLE"] },
  { name: "Mike Tomlin", teams: ["PIT"] },
  { name: "Mike Vrabel", teams: ["TEN", "NE"] },
  { name: "Mike Zimmer", teams: ["MIN"] },
  { name: "Nathaniel Hackett", teams: ["DEN"] },
  { name: "Nick Sirianni", teams: ["PHI"] },
  { name: "Pat Shurmur", teams: ["PHI", "NYG"] },
  { name: "Perry Fewell", teams: ["CAR"] },
  { name: "Pete Carroll", teams: ["SEA", "LV"] },
  { name: "Raheem Morris", teams: ["ATL"] },
  { name: "Rex Ryan", teams: ["BUF"] },
  { name: "Rich Bisaccia", teams: ["LV"] },
  { name: "Robert Saleh", teams: ["NYJ", "TEN"] },
  { name: "Romeo Crennel", teams: ["HOU"] },
  { name: "Ron Rivera", teams: ["CAR", "WAS"] },
  { name: "Sean McDermott", teams: ["BUF"] },
  { name: "Sean McVay", teams: ["LAR"] },
  { name: "Sean Payton", teams: ["NO", "DEN"] },
  { name: "Shane Steichen", teams: ["IND"] },
  { name: "Steve Spagnuolo", teams: ["NYG"] },
  { name: "Steve Wilks", teams: ["ARI", "CAR"] },
  { name: "Thomas Brown", teams: ["CHI"] },
  { name: "Todd Bowles", teams: ["NYJ", "TB"] },
  { name: "Todd Monken", teams: ["CLE"] },
  { name: "Tom Coughlin", teams: ["NYG"] },
  { name: "Urban Meyer", teams: ["JAX"] },
  { name: "Vance Joseph", teams: ["DEN"] },
  { name: "Vic Fangio", teams: ["DEN"] },
  { name: "Zac Taylor", teams: ["CIN"] },
];

/** How two spellings of a coach's name compare: case, punctuation and spacing ignored. */
export function coachKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The bank coach with this name, however it is spelled. */
export function findBankCoach(name: string): BankCoach | undefined {
  const key = coachKey(name);
  return NFL_HEAD_COACHES.find((c) => coachKey(c.name) === key);
}

/**
 * Coaches whose name contains the search, created coaches first, then the bank alphabetically.
 * An empty search lists everyone.
 */
export function searchCoaches(created: readonly BankCoach[], text: string, limit = 12): BankCoach[] {
  const key = coachKey(text);
  const bank = [...NFL_HEAD_COACHES].sort((a, b) => a.name.localeCompare(b.name));
  return [...created, ...bank].filter((c) => coachKey(c.name).includes(key)).slice(0, limit);
}

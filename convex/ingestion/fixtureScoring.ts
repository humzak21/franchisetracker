/**
 * The canned scoring summary: plays that add up to the game's final, or the box score fixture's
 * 31 to 17 for a game not played yet. The first score is the screen's glitch: a touchdown with
 * the name missing, for review and the game page to assign.
 */
const sure = { confidence: 0.95, unclear_fields: [] as string[] };

export type ScoringGame = {
  home: string;
  away: string;
  userIsHome: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
};

/** A score as touchdowns and field goals. */
function scores(total: number): (7 | 3)[] {
  let sevens = Math.floor(total / 7);
  while ((total - sevens * 7) % 3 !== 0) sevens--;
  return [...Array<7>(sevens).fill(7), ...Array<3>((total - sevens * 7) / 3).fill(3)];
}

const OUR_PLAYS = [
  { name: null, kind: "pass_td", yards: 15, passer: "D. Maye" },
  { name: "T. Henderson", kind: "rush_td", yards: 4, passer: null },
  { name: "S. Diggs", kind: "pass_td", yards: 32, passer: "D. Maye" },
  { name: "T. Henderson", kind: "rush_td", yards: 21, passer: null },
];

export function fixtureScoring(game: ScoringGame): { rows: Record<string, unknown>[] } {
  const home = game.homeScore ?? (game.userIsHome ? 31 : 17);
  const away = game.awayScore ?? (game.userIsHome ? 17 : 31);
  const ourTeam = game.userIsHome ? game.home : game.away;
  const ours = scores(game.userIsHome ? home : away);
  const queue = [
    ...ours.map((points) => ({ us: true, points })),
    ...scores(game.userIsHome ? away : home).map((points) => ({ us: false, points })),
  ];
  // Our scores first in the list, then woven with theirs so the lead moves.
  const order = queue
    .map((play, i) => ({ play, at: play.us ? i : i - ours.length + 0.5 }))
    .sort((a, b) => a.at - b.at)
    .map((p) => p.play);

  const perPeriod = Math.ceil(order.length / 4);
  let touchdowns = 0;
  let homeScore = 0;
  let awayScore = 0;
  const rows = order.map(({ us, points }, i) => {
    const team = us === game.userIsHome ? game.home : game.away;
    if (team === game.home) homeScore += points;
    else awayScore += points;
    const when = {
      quarter: String(Math.floor(i / perPeriod) + 1),
      clock: `${14 - (i % perPeriod) * 3}:05`,
      home_score: homeScore,
      away_score: awayScore,
    };
    if (points === 3) {
      return {
        ...when,
        team,
        name: team === ourTeam ? "A. Borregales" : "D. Carlson",
        kind: "fg",
        yards: 40 + i,
        passer: null,
        pat: null,
        description: `${40 + i} yd field goal`,
        ...sure,
      };
    }
    const play =
      team === ourTeam
        ? (OUR_PLAYS[touchdowns++ % OUR_PLAYS.length] ?? OUR_PLAYS[0])
        : { name: "R. Stevenson", kind: "rush_td", yards: 2, passer: null };
    return { ...when, ...play, team, pat: "kick", description: "", ...sure };
  });
  return { rows };
}

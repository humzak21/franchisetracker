/** How much of a season has been captured (FEATURES.md 5.1), as a strip of counts. Pure. */
export type CoverageFacts = {
  played: number;
  boxScores: number;
  teamStats: number;
  scoringSummaries: number;
  regularGames: number;
  standingsGames: number;
  awardWeeks: number;
};

export type CoverageItem = { key: string; label: string; have: number; of: number };

export const coverageItems = (f: CoverageFacts): CoverageItem[] => [
  { key: "box", label: "Box scores", have: f.boxScores, of: f.played },
  { key: "team", label: "Team stats", have: f.teamStats, of: f.played },
  { key: "scoring", label: "Scoring", have: f.scoringSummaries, of: f.played },
  {
    key: "standings",
    label: "Standings",
    have: Math.min(f.standingsGames, f.regularGames),
    of: f.regularGames,
  },
  { key: "awards", label: "Weekly awards", have: Math.min(f.awardWeeks, f.regularGames), of: f.regularGames },
];

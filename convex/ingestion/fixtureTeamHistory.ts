/** The canned team history table: two Patriots seasons from before the nflverse import, one doubtful. */
const sure = { confidence: 0.95, unclear_fields: [] as string[] };

export const FIXTURE_TEAM_HISTORY = {
  rows: [
    {
      year: 1985,
      w: 11,
      l: 5,
      t: 0,
      division_rank: 2,
      seed: 5,
      playoff_result: "sb_loss",
      head_coach: "Raymond Berry",
      points_for: 362,
      points_against: 290,
      note: null,
      ...sure,
    },
    {
      year: 1986,
      w: 11,
      l: 5,
      t: 0,
      division_rank: 1,
      playoff_result: "div_loss",
      confidence: 0.7,
      unclear_fields: ["seed"],
    },
  ],
};

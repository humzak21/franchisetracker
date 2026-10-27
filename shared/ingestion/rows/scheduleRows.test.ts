/** The league schedule screen: nicknames resolve, shots merge per matchup, and the week is checked. */
import { describe, expect, test } from "vitest";
import type { Normalized } from "../normalize";
import { mergeFor, normalizeFor, validateDraft } from "../targets";
import type { RowTargetDraft } from "../types";

const sure = { confidence: 0.95, unclear_fields: [] };
const read = (raw: unknown) => normalizeFor("league_schedule", raw) as Normalized<RowTargetDraft>;
const draftOf = (raw: unknown) => read(raw).draft as RowTargetDraft;
const errors = (draft: RowTargetDraft) =>
  validateDraft(draft)
    .filter((w) => w.severity === "error")
    .map((w) => w.message);

const SHOT_1 = {
  week: "Week 15",
  rows: [
    {
      away_team: "49ers",
      home_team: "Chargers",
      away_score: 23,
      home_score: 20,
      time: "Thu 8:15 PM",
      ...sure,
    },
    {
      away_team: "Seahawks",
      home_team: "Eagles",
      away_score: 42,
      home_score: 21,
      time: "Sat 5:00 PM",
      ...sure,
    },
  ],
};
const SHOT_2 = {
  week: "w15",
  rows: [
    {
      away_team: "Seahawks",
      home_team: "Eagles",
      away_score: 42,
      home_score: 21,
      time: "Sat 5:00 PM",
      ...sure,
    },
    {
      away_team: "Commanders",
      home_team: "Giants",
      away_score: null,
      home_score: null,
      time: "Sun 1:00 PM",
      ...sure,
    },
  ],
};

describe("league schedule", () => {
  test("matchups resolve nicknames to teams, away first, with the week from the header", () => {
    const draft = draftOf(SHOT_1);
    expect(draft.meta.week).toBe("w15");
    expect(
      draft.rows.map((r) => [r.values.awayTeam, r.values.homeTeam, r.values.awayScore, r.values.homeScore]),
    ).toEqual([
      ["SF", "LAC", 23, 20],
      ["SEA", "PHI", 42, 21],
    ]);
    expect(draft.rows[0]!.values.time).toBe("Thu 8:15 PM");
    expect(errors(draft)).toEqual([]);
  });

  test("a week spread over several shots merges into one row per matchup", () => {
    const merged = mergeFor("league_schedule", [read(SHOT_1), read(SHOT_2)]);
    const draft = merged.draft as RowTargetDraft;
    expect(draft.rows).toHaveLength(3);
    expect(draft.rows.find((r) => r.values.awayTeam === "WAS")?.values.homeScore ?? null).toBeNull();
    expect(merged.warnings).toEqual([]);
    // A game not played yet has neither score, which is fine.
    expect(errors(draft)).toEqual([]);
  });

  test("two shots that disagree on a score are flagged", () => {
    const misread = { rows: [{ ...SHOT_1.rows[0], home_score: 26 }] };
    const merged = mergeFor("league_schedule", [read(SHOT_1), read(misread)]);
    expect(merged.warnings.map((w) => w.message)).toEqual(["A row: two screenshots disagree (20 and 26)"]);
  });

  test("a team twice in a week, one score without the other, or a team playing itself is an error", () => {
    const draft = draftOf({
      rows: [
        { away_team: "SF", home_team: "LAC", away_score: 23, home_score: null, ...sure },
        { away_team: "SF", home_team: "SEA", away_score: 10, home_score: 7, ...sure },
        { away_team: "BUF", home_team: "Bills", away_score: 3, home_score: 0, ...sure },
      ],
    });
    expect(errors(draft)).toEqual([
      "SF @ LAC: enter both scores, or neither for a game not played yet",
      "SF is in two games this week",
      "BUF cannot play itself",
    ]);
  });

  test("an unknown team leaves the matchup to fill in", () => {
    const draft = draftOf({ rows: [{ away_team: "Rattlers", home_team: "Chargers", ...sure }] });
    expect(draft.rows[0]!.values.awayTeam).toBeUndefined();
    expect(errors(draft)).toContain("A row: away is missing");
  });
});

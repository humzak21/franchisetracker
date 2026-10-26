/** Extraction validators for the stat screens: league leaders, team season stats and standings. */
import { describe, expect, test } from "vitest";
import { normalizeFor, validateDraft, type RowTargetKey } from "../targets";
import type { RowTargetDraft } from "../types";

const sure = { confidence: 0.95, unclear_fields: [] };
const read = (target: RowTargetKey, raw: unknown) => normalizeFor(target, raw).draft as RowTargetDraft;
const messages = (draft: RowTargetDraft) => validateDraft(draft).map((w) => w.message);

describe("league leaders", () => {
  test("a rank with a better value than the rank above it is a misread", () => {
    const draft = read("league_leaders", {
      stat: "Rushing Yards",
      rows: [
        { rank: 1, name: "D. Henry", team: "BAL", value: 900, ...sure },
        { rank: 2, name: "S. Barkley", team: "PHI", value: 950, ...sure },
      ],
    });
    expect(draft.meta).toEqual({ stat: "rushYds" });
    expect(messages(draft)).toContain("Rank 2 has a better value than the rank above it");
  });

  test("a board in rank order is not flagged", () => {
    const draft = read("league_leaders", {
      stat: "Passing Yards",
      rows: [
        { rank: 1, name: "J. Allen", team: "BUF", value: 1620, ...sure },
        { rank: 2, name: "D. Maye", team: "NE", value: 1450, ...sure },
      ],
    });
    expect(messages(draft).filter((m) => m.includes("better value"))).toEqual([]);
  });
});

describe("team season stats", () => {
  test("resolves the stat by label, and ranks run from 1 to 32", () => {
    const draft = read("team_season_stats", {
      team: "Patriots",
      rows: [
        { stat: "Points per game", value: 28, rank: 3, tied: true, ...sure },
        { stat: "Sacks", value: 41, rank: 40, ...sure },
      ],
    });
    expect(draft.meta).toMatchObject({ team: "NE" });
    expect(draft.rows.map((r) => [r.values.stat, r.values.tied ?? null])).toEqual([
      ["pointsPg", true],
      ["sacks", null],
    ]);
    expect(messages(draft)).toContain("Ranks run from 1 to 32");
  });
});

describe("standings", () => {
  test("more games than a season is a warning; a bad division rank blocks the commit", () => {
    const draft = read("standings", {
      rows: [{ team: "NE", w: 12, l: 6, t: 0, division_rank: 5, ...sure }],
    });
    const warnings = validateDraft(draft);
    expect(warnings.find((w) => w.message === "NE: 18 games is more than a season")?.severity).toBe(
      "warning",
    );
    expect(warnings.find((w) => w.message === "Division ranks run from 1 to 4")?.severity).toBe("error");
  });
});

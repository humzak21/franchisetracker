import { describe, expect, it } from "vitest";
import { MAX_CHUNK_BYTES, chunkImages, mergeAnswers } from "./chunks";
import { normalizeBoxScore } from "./normalize";

const MB = 1024 * 1024;
const images = (...sizes: number[]) => sizes.map((size, i) => ({ id: i, size }));
const ids = (chunks: { id: number }[][]) => chunks.map((c) => c.map((i) => i.id));

describe("chunkImages", () => {
  it("keeps a small set in one request", () => {
    expect(ids(chunkImages(images(MB, MB)))).toEqual([[0, 1]]);
  });

  it("sends at most three screenshots per request, in order", () => {
    expect(ids(chunkImages(images(...Array<number>(8).fill(MB))))).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7],
    ]);
  });

  it("starts a new request before the byte budget is passed", () => {
    expect(ids(chunkImages(images(9 * MB, 9 * MB, 9 * MB, 2 * MB)))).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("gives an oversized screenshot a request of its own", () => {
    expect(ids(chunkImages(images(MB, MAX_CHUNK_BYTES + MB, MB)))).toEqual([[0], [1], [2]]);
  });
});

describe("mergeAnswers", () => {
  const empty = {
    home_team: null,
    away_team: null,
    home_score: null,
    away_score: null,
    home_quarters: [],
    away_quarters: [],
    overtime: false,
    passing: [],
    rushing: [],
  };

  it("joins each tab's rows and keeps the score from the chunk that saw it", () => {
    const summary = {
      ...empty,
      home_team: "NE",
      away_team: "BUF",
      home_score: 31,
      away_score: 24,
      home_quarters: [7, 10, 7, 0, 7],
      away_quarters: [3, 14, 0, 7, 0],
      overtime: true,
      passing: [{ name: "D. Maye", team: "NE", pass_yds: 284 }],
    };
    const tabs = {
      ...empty,
      home_team: "NE",
      passing: [{ name: "J. Allen", team: "BUF", pass_yds: 215 }],
      rushing: [{ name: "D. Maye", team: "NE", rush_yds: 24 }],
    };
    expect(mergeAnswers([summary, tabs])).toEqual({
      ...summary,
      passing: [...summary.passing, ...tabs.passing],
      rushing: tabs.rushing,
    });
  });

  it("goes with the value most chunks agree on", () => {
    const score = (home_score: number) => ({ ...empty, home_score });
    expect(mergeAnswers([score(21), score(31), score(31)])).toMatchObject({ home_score: 31 });
  });

  it("returns a single answer untouched", () => {
    expect(mergeAnswers([empty])).toBe(empty);
  });

  it("lets the box score merge a player read on two screens and flag a disagreement", () => {
    const row = (pass_yds: number) => ({ name: "D. Maye", team: "NE", pass_yds, confidence: 0.9 });
    const merged = mergeAnswers([
      { ...empty, passing: [row(284)] },
      { ...empty, passing: [row(290)] },
    ]);
    const { draft, warnings } = normalizeBoxScore(merged);
    expect(draft.lines).toHaveLength(1);
    expect(warnings).toContainEqual(expect.objectContaining({ message: expect.stringMatching(/disagree/) }));
  });
});

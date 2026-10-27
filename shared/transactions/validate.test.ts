import { describe, expect, test } from "vitest";
import { moveShapeError } from "./validate";

const empty = { teamId: "NE", playersIn: [], playersOut: [], picksIn: [], picksOut: [] };

describe("move shape", () => {
  test("a trade needs a different partner and at least one asset", () => {
    expect(moveShapeError({ ...empty, type: "trade" })).toMatch(/other team/);
    expect(moveShapeError({ ...empty, type: "trade", counterpartTeamId: "NE" })).toMatch(/different/);
    expect(moveShapeError({ ...empty, type: "trade", counterpartTeamId: "KC" })).toMatch(/sends/);
    expect(moveShapeError({ ...empty, type: "trade", counterpartTeamId: "KC", picksOut: [{}] })).toBeNull();
    expect(
      moveShapeError({ ...empty, type: "trade", counterpartTeamId: "KC", picksIn: Array(15).fill({}) }),
    ).toMatch(/picks a side/);
  });

  test("every other move names exactly one player and no picks", () => {
    expect(moveShapeError({ ...empty, type: "sign" })).toMatch(/one player/);
    expect(moveShapeError({ ...empty, type: "sign", playersIn: ["a"] })).toBeNull();
    expect(moveShapeError({ ...empty, type: "release", playersOut: ["a"], picksOut: [{}] })).toMatch(/picks/);
    expect(moveShapeError({ ...empty, type: "ir", playersIn: ["a"], playersOut: ["b"] })).toMatch(
      /one player/,
    );
  });
});

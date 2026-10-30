import { describe, expect, test } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import {
  gameWinnerLine,
  playersMissing,
  summaryPlays,
  wormOf,
  wormPeriods,
  type ScoringData,
} from "./scoringViews";

const us = "ne" as Id<"teams">;
const them = "buf" as Id<"teams">;
const team = { abbr: "NE", primaryColor: "#000", secondaryColor: "#fff" };

type Play = ScoringData["plays"][number];
const play = (over: Partial<Play>): Play => ({
  _id: "p" as Play["_id"],
  period: 1,
  clock: 600,
  teamId: us,
  kind: "pass_td",
  yards: 15,
  playerId: null,
  scorer: null,
  passerId: null,
  passer: "D. Maye",
  pat: "kick",
  homeScore: 7,
  awayScore: 0,
  description: null,
  ...over,
});

const data = (plays: Play[], over: Partial<ScoringData> = {}): ScoringData => ({
  plays,
  gameWinnerId: null,
  leadChanges: 0,
  ties: 0,
  deficitOvercome: 0,
  context: {
    homeAbbr: "NE",
    awayAbbr: "BUF",
    homeScore: 7,
    awayScore: 0,
    lines: [{ playerId: "boutte" as Id<"players">, name: "K. Boutte", teamAbbr: "NE", stats: { recTd: 1 } }],
  },
  ...over,
});

describe("who needs a player", () => {
  test("a dropped name does, on either team", () => {
    const nameless = data([play({}), play({ _id: "q" as Play["_id"], teamId: them })]);
    expect(playersMissing(nameless, us)).toBe(2);
  });

  test("our own unmatched scorer does; an opponent's printed name does not", () => {
    const printed = data([
      play({ scorer: "K. Boutte" }),
      play({ _id: "q" as Play["_id"], teamId: them, scorer: "J. Cook" }),
    ]);
    expect(playersMissing(printed, us)).toBe(1);
  });

  test("a matched player and a safety do not", () => {
    const fine = data([
      play({ playerId: "boutte" as Id<"players">, scorer: "K. Boutte" }),
      play({ _id: "q" as Play["_id"], kind: "safety", scorer: null }),
    ]);
    expect(playersMissing(fine, us)).toBe(0);
  });
});

test("a nameless play offers the one player it can only be", () => {
  const [row] = summaryPlays(data([play({})]), () => team, us);
  expect(row).toMatchObject({
    needsPlayer: true,
    suggestion: "K. Boutte",
    description: "15 yd pass from D. Maye",
  });
});

test("the game-winner reads in full, when there is one", () => {
  const winner = play({ scorer: "K. Boutte", period: 4, clock: 134 });
  expect(gameWinnerLine(data([winner], { gameWinnerId: winner._id }))).toBe(
    "K. Boutte 15 yd pass from D. Maye, Q4 2:14",
  );
  expect(gameWinnerLine(data([winner]))).toBeNull();
});

test("the worm starts level and an overtime game gets a fifth period", () => {
  const overtime = data([play({ period: 5, scorer: "K. Boutte" })]);
  const points = wormOf(overtime, true);
  expect(points[0]).toMatchObject({ seconds: 0, margin: 0, play: null });
  expect(points[1]?.play?.when).toBe("OT 10:00");
  expect(wormPeriods(overtime)).toHaveLength(5);
});

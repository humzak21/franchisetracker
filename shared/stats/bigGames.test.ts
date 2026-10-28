import { describe, expect, test } from "vitest";
import {
  GAME_THRESHOLDS,
  SEASON_HIGH_STATS,
  SINGLE_GAME_MINIMUMS,
  STAT_GROUPS,
  STAT_REGISTRY,
  detectMilestones,
  gameHighlights,
  gameThreshold,
  gameThresholdsMet,
  seasonHighs,
  singleGameValue,
  statGroup,
  summarizeGames,
  type StatLine,
} from "./index";

const keys = (list: readonly { key: string }[]) => list.map((t) => t.key);
const perfect: StatLine = { passCmp: 12, passAtt: 12, passYds: 200, passTd: 3, passInt: 0 };

describe("threshold games", () => {
  test("2+ TD counts scrimmage touchdowns, and counting is inclusive", () => {
    expect(keys(gameThresholdsMet({ rushTd: 1, recTd: 1 }))).toEqual(["scrimmage2td"]);
    expect(keys(gameThresholdsMet({ rushTd: 2, recTd: 1 }))).toEqual(["scrimmage2td", "scrimmage3td"]);
    expect(summarizeGames([{ rushTd: 3 }, { recTd: 2 }, { rushTd: 1 }]).thresholdCounts).toEqual({
      scrimmage2td: 2,
      scrimmage3td: 1,
    });
  });

  test("a box score marks only the highest threshold met per stat", () => {
    expect(keys(gameHighlights({ rushTd: 2, recTd: 1 }))).toEqual(["scrimmage3td"]);
    expect(keys(gameHighlights({ rushYds: 120, rushTd: 2 }))).toEqual(["rush100", "scrimmage2td"]);
  });

  test("a perfect passer rating needs ten attempts", () => {
    expect(keys(gameThresholdsMet({ passCmp: 1, passAtt: 1, passYds: 40, passTd: 1 }))).toEqual([]);
    expect(keys(gameThresholdsMet(perfect))).toEqual(["pass3td", "perfectRating"]);
    expect(gameThreshold("perfectRating").header).toBe("158.3s");
  });

  test("a 2-TD game is minor: no milestone, while a 3-TD game is news", () => {
    const game = (line: StatLine) =>
      detectMilestones({ name: "R. Back", line, priorGames: [], seasonBefore: {}, priorSeasons: [] })
        .filter((m) => m.kind === "threshold_game")
        .map((m) => m.key);
    expect(game({ rushTd: 2 })).toEqual([]);
    expect(game({ rushTd: 3 })).toEqual(["game:scrimmage3td"]);
  });
});

describe("group count columns", () => {
  test("each group declares the big games the season table always shows", () => {
    expect(statGroup("qb").counts).toEqual(["pass300", "pass3td", "perfectRating", "rush100"]);
    expect(statGroup("rb").counts).toEqual(["rush100", "rec100", "rec5", "scrimmage2td"]);
    expect(statGroup("wrte").counts).toEqual(["rec100", "rec5", "rush100", "scrimmage2td"]);
    for (const id of ["dl", "lb", "db"]) expect(statGroup(id).counts).toEqual(["sacks2", "int2"]);
  });

  test("every count is a known threshold on a stat in the group's categories", () => {
    for (const group of STAT_GROUPS) {
      for (const key of group.counts) {
        const t = GAME_THRESHOLDS.find((g) => g.key === key);
        expect(t, `${group.id}: ${key}`).toBeDefined();
        expect(group.categories).toContain(STAT_REGISTRY[t!.stat].category);
      }
    }
  });
});

describe("season highs", () => {
  test("best game per stat with its game and week; a tie goes to the earliest week", () => {
    const highs = seasonHighs([
      { gameId: "g3", weekKey: "w3", line: { rushAtt: 15, rushYds: 121, rushTd: 1 } },
      { gameId: "g1", weekKey: "w1", line: { rushAtt: 20, rushYds: 88, rushTd: 1 } },
      { gameId: "wc", weekKey: "wc", line: { rushAtt: 18, rushYds: 121, rushTd: 0 } },
    ]);
    expect(highs.rushYds).toEqual({ value: 121, gameId: "g3", weekKey: "w3" });
    expect(highs.rushTd).toEqual({ value: 1, gameId: "g1", weekKey: "w1" });
    expect(highs.rushAtt).toEqual({ value: 20, gameId: "g1", weekKey: "w1" });
    expect(highs.rushAvg?.gameId).toBe("g3");
  });

  test("rate stats need volume: a 1-for-1 game is not the best completion percentage", () => {
    const highs = seasonHighs([
      { gameId: "cameo", weekKey: "w1", line: { passCmp: 1, passAtt: 1, passYds: 30, passTd: 1 } },
      { gameId: "start", weekKey: "w2", line: { passCmp: 18, passAtt: 25, passYds: 240, passTd: 2 } },
    ]);
    expect(highs.passCmpPct).toEqual({ value: 72, gameId: "start", weekKey: "w2" });
    expect(highs.passRating?.gameId).toBe("start");
    // Counting stats have no minimum.
    expect(highs.passTd).toEqual({ value: 2, gameId: "start", weekKey: "w2" });
    expect(singleGameValue("passRating", { passCmp: 1, passAtt: 1, passYds: 30 })).toBeNull();
  });

  test("zeros, per-game rates, longest plays and lower-is-better stats are not highs", () => {
    const highs = seasonHighs([
      { gameId: "g", weekKey: "w1", line: { sacks: 0, tackles: 6, passInt: 2, passLong: 40 } },
    ]);
    expect(Object.keys(highs)).toEqual(["tackles"]);
    for (const key of ["passYpg", "passInt", "passLong", "fumbles"] as const)
      expect(SEASON_HIGH_STATS).not.toContain(key);
    expect(SEASON_HIGH_STATS).toEqual(
      expect.arrayContaining(["passRating", "scrimmageYds", "sacks", "fantasyPts"]),
    );
  });

  test("every rate stat with a season high has a minimum", () => {
    for (const key of SEASON_HIGH_STATS) {
      const def = STAT_REGISTRY[key];
      // Fantasy points are a decimal total, not a rate: any game can set the high.
      if (def.kind === "derived" && def.format !== "int" && def.category !== "fantasy")
        expect(SINGLE_GAME_MINIMUMS, key).toHaveProperty(key);
    }
  });
});

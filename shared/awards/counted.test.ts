import { describe, expect, it } from "vitest";
import { CONTENDERS, countedContenders, countedWinners, type LeagueLine } from "./counted";

const line = (playerId: string, teamId: string, stats: LeagueLine<string>["line"], games = 10) => ({
  playerId,
  teamId,
  line: stats,
  games,
});

describe("countedContenders", () => {
  const lines = [
    line("allen", "BUF", { passYds: 4000, passTd: 30, passInt: 10, rushYds: 500, rushTd: 8 }),
    line("hill", "MIA", { rec: 110, recYds: 1500, recTd: 10 }),
    line("parsons", "DAL", { tackles: 60, sacks: 15.5 }),
    line("watt", "PIT", { tackles: 55, sacks: 15.5, defInt: 1 }),
    line("hamilton", "BAL", { tackles: 100, defInt: 6 }),
  ];

  it("crowns the league leader in each stat, ties included", () => {
    const awards = countedContenders(lines, []);
    // 160 + 120 - 20 + 50 + 48
    expect(awards.FPOY[0]).toMatchObject({ playerId: "allen", value: 358, statLine: "358.0 fantasy pts" });
    expect(countedWinners(awards.SackLeader).map((c) => c.playerId)).toEqual(["parsons", "watt"]);
    expect(awards.SackLeader[0]!.statLine).toBe("15.5 sacks");
    expect(countedWinners(awards.BallHawk)).toMatchObject([{ playerId: "hamilton", statLine: "6 INT" }]);
    expect(awards.HeatSeeker[0]).toMatchObject({ playerId: "hamilton", value: 100 });
  });

  it("leaves out zeros, so a stat nobody recorded has no winner", () => {
    const awards = countedContenders([line("hill", "MIA", { rec: 1 })], []);
    expect(awards.SackLeader).toEqual([]);
    expect(countedWinners(awards.SackLeader)).toEqual([]);
  });

  it("sums a traded player's lines under his last team", () => {
    const awards = countedContenders(
      [line("x", "NYJ", { sacks: 4 }, 6), line("x", "MIA", { sacks: 5 }, 11), line("y", "NE", { sacks: 8 })],
      [],
    );
    expect(awards.SackLeader[0]).toMatchObject({ playerId: "x", teamId: "MIA", value: 9 });
  });

  it("counts players of the week by player, or by name when unmatched", () => {
    const awards = countedContenders(
      [],
      [
        { type: "OPOW", playerId: "allen", name: "Josh Allen", teamId: "BUF" },
        { type: "OPOW", playerId: "allen", name: "Josh Allen", teamId: "BUF" },
        { type: "OPOW", playerId: null, name: "Someone Else", teamId: null },
        { type: "DPOW", playerId: null, name: "T.J. Watt", teamId: "PIT" },
        { type: "DPOW", playerId: null, name: "t.j. watt", teamId: "PIT" },
        { type: "ROW", playerId: "rookie", name: "Rookie", teamId: "NE" },
      ],
    );
    expect(awards.MostOPOW[0]).toMatchObject({
      playerId: "allen",
      value: 2,
      statLine: "2× Offensive Player of the Week",
    });
    expect(awards.MostOPOW).toHaveLength(2);
    expect(awards.MostDPOW).toMatchObject([{ playerId: null, name: "T.J. Watt", value: 2 }]);
  });

  it("lists a few contenders behind the leader, keeping ties at the cutoff", () => {
    const many = Array.from({ length: 8 }, (_, i) => line(`p${i}`, "NE", { defInt: i < 6 ? 3 : 1 }));
    const awards = countedContenders(many, []);
    expect(awards.BallHawk.length).toBeGreaterThan(CONTENDERS);
    expect(awards.BallHawk.every((c) => c.value === 3)).toBe(true);
  });
});

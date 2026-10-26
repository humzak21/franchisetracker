import { describe, expect, it } from "vitest";
import { byDecade, trophiesFor, trophyRoom, type SeasonRecordLike } from "./trophies";

const seasons: SeasonRecordLike[] = [
  { year: 2025, userRecord: { w: 9, l: 8, t: 0, divisionRank: 2, playoffResult: "missed" } },
  { year: 2029, userRecord: { w: 15, l: 2, t: 0, divisionRank: 1, playoffResult: "champion" } },
  { year: 2030, userRecord: { w: 14, l: 3, t: 0, divisionRank: 1, playoffResult: "sb_loss" } },
  { year: 2031 },
];

describe("trophies", () => {
  it("derives trophies from a season result", () => {
    expect(trophiesFor(seasons[1]!)).toEqual(["superBowl", "conference", "division", "playoffs"]);
    expect(trophiesFor(seasons[2]!)).toEqual(["conference", "division", "playoffs"]);
    expect(trophiesFor(seasons[0]!)).toEqual([]);
    expect(trophiesFor(seasons[3]!)).toEqual([]);
  });

  it("merges real-history entries without double counting", () => {
    const room = trophyRoom(seasons, [
      { year: 2019, kind: "superBowl" },
      { year: 2029, kind: "superBowl" },
    ]);
    expect(room.superBowl).toEqual([
      { year: 2029, source: "franchise" },
      { year: 2019, source: "history" },
    ]);
    expect(room.division.map((t) => t.year)).toEqual([2030, 2029]);
  });

  it("groups seasons by decade with totals", () => {
    const decades = byDecade(seasons);
    expect(decades.map((d) => d.decade)).toEqual([2020, 2030]);
    expect(decades[0]!.totals).toEqual({ w: 24, l: 10, t: 0, playoffs: 1, titles: 1 });
    expect(decades[1]!.seasons.map((s) => s.year)).toEqual([2030, 2031]);
  });
});

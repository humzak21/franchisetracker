import { describe, expect, test } from "vitest";
import { careerCandidates, mergeEntries, rankList, seasonCandidates, type StatRow } from "./recordBoards";

const row = (
  playerId: string,
  year: number,
  teamId: string,
  totals: StatRow["totals"],
  gamesPlayed = 10,
): StatRow => ({
  playerId,
  seasonId: `s${year}`,
  year,
  teamId,
  gamesPlayed,
  totals,
  bests: { rushYds: Math.round((totals.rushYds ?? 0) / 4) },
});

describe("record boards", () => {
  test("a traded player's season is one entry, shown with the team he played most for", () => {
    const { season, game } = seasonCandidates([
      row("a", 2026, "NE", { rushYds: 600 }, 6),
      row("a", 2026, "BUF", { rushYds: 700 }, 11),
      row("b", 2026, "NE", { rushYds: 1100 }),
    ]);
    expect(season.get("rushYds")).toEqual([
      expect.objectContaining({ playerId: "a", value: 1300, teamId: "BUF" }),
      expect.objectContaining({ playerId: "b", value: 1100 }),
    ]);
    expect(game.get("rushYds")?.find((e) => e.playerId === "a")?.value).toBe(175);
  });

  test("merging keeps the best, one per player and season, and lets a correction lower a number", () => {
    const first = mergeEntries(
      [],
      [
        { playerId: "a", value: 10, year: 2026 },
        { playerId: "b", value: 8, year: 2026 },
      ],
      "season",
      2,
    );
    const corrected = mergeEntries(
      first,
      [
        { playerId: "a", value: 5, year: 2026 },
        { playerId: "c", value: 9, year: 2027 },
      ],
      "season",
      2,
    );
    expect(corrected.map((e) => [e.playerId, e.value])).toEqual([
      ["c", 9],
      ["b", 8],
    ]);
    const careers = mergeEntries(
      [],
      [
        { playerId: "a", value: 10, year: 2026 },
        { playerId: "a", value: 12, year: 2027 },
      ],
      "career",
    );
    expect(careers).toEqual([{ playerId: "a", value: 12, year: 2027 }]);
  });

  test("career entries carry the span", () => {
    const [entry] = careerCandidates([
      { playerId: "a", totals: { sacks: 120 }, firstYear: 1999, lastYear: 2012 },
    ]).get("sacks")!;
    expect(entry).toMatchObject({ value: 120, year: 2012, firstYear: 1999 });
  });

  test("typed entries replace the same player's computed one and rank with ties", () => {
    const computed = [
      { playerId: "p1", value: 171.5, year: 2003, firstYear: 1985 },
      { playerId: "p2", value: 150, year: 2010 },
      { playerId: "p3", value: 150, year: 2012 },
    ];
    const names: Record<string, string> = { p1: "Bruce Smith", p2: "A", p3: "B" };
    const list = rankList(
      computed,
      [
        { _id: "t1", name: "Bruce Smith", value: 200 },
        { _id: "t2", name: "Reggie White", value: 198 },
      ],
      "career",
      (id) => names[id],
    );
    expect(list.map((e) => [e.rank, e.playerId ?? e.name, e.value])).toEqual([
      [1, "Bruce Smith", 200],
      [2, "Reggie White", 198],
      [3, "p2", 150],
      [3, "p3", 150],
    ]);
  });
});

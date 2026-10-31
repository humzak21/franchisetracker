import { describe, expect, it } from "vitest";
import { whereWeRank } from "./leagueLeaders";
import { distinctMarks, rankMarks, type PlayerMark } from "./marks";
import { mergeEntries, rankList, seasonCandidates, sharedRanks } from "./recordBoards";
import { rankStat, TOP_GAMES, type SeasonRow } from "./records";
import { topGames } from "./seasonHighs";
import { rankRuns, streakPointLabel, streakSpanLabel } from "./streaks";
import { playerTimeline, type TimelineMark, type TimelineMilestone } from "./timeline";

const game = (gameId: string, weekKey: "w1" | "w2" | "w3" | "w4", rushYds: number) => ({
  gameId,
  weekKey,
  line: { rushYds, rushTd: 0 },
});

describe("topGames", () => {
  it("keeps a season's three best games per stat, the earlier game on a tie", () => {
    const top = topGames([
      game("a", "w1", 100),
      game("b", "w2", 180),
      game("c", "w3", 100),
      game("d", "w4", 90),
    ]);
    expect(top.rushYds?.map((g) => g.gameId)).toEqual(["b", "a", "c"]);
    expect(top.rushYds).toHaveLength(TOP_GAMES);
  });

  it("does not remember a game with nothing in it", () => {
    expect(topGames([game("a", "w1", 100)]).rushTd).toBeUndefined();
  });
});

describe("single-game lists", () => {
  const row: SeasonRow = {
    playerId: "p",
    seasonId: "s",
    year: 2027,
    totals: { rushYds: 400 },
    bests: { rushYds: 200 },
    topGames: {
      rushYds: [
        { value: 200, gameId: "g1", weekKey: "w1" },
        { value: 150, gameId: "g2", weekKey: "w2" },
      ],
    },
  };

  it("ranks every game kept, not one per season", () => {
    expect(rankStat([row], "rushYds", "game").map((e) => [e.value, e.gameId])).toEqual([
      [200, "g1"],
      [150, "g2"],
    ]);
  });

  it("falls back to the plain best on a row from before games were kept", () => {
    const { topGames: _kept, ...old } = row;
    expect(rankStat([old], "rushYds", "game")).toEqual([
      { playerId: "p", seasonId: "s", year: 2027, value: 200 },
    ]);
  });

  it("merges a trade's two rows into one season's best games", () => {
    const base = { playerId: "p", seasonId: "s", year: 2027, gamesPlayed: 8 };
    const { game: games } = seasonCandidates([
      { ...base, teamId: "a", totals: {}, bests: {}, topGames: { rushYds: [{ value: 90, weekKey: "w1" }] } },
      { ...base, teamId: "b", totals: {}, bests: {}, topGames: { rushYds: [{ value: 120, weekKey: "w3" }] } },
    ]);
    expect(games.get("rushYds")?.map((e) => e.value)).toEqual([120, 90]);
  });

  it("replaces a season's games as a set, so one that dropped out goes", () => {
    const entry = (value: number, weekKey: "w1" | "w2") => ({
      playerId: "p",
      year: 2027,
      value,
      weekKey,
    });
    const before = mergeEntries([], [entry(200, "w1"), entry(150, "w2")], "game");
    expect(before.map((e) => e.value)).toEqual([200, 150]);
    expect(mergeEntries(before, [entry(170, "w2")], "game").map((e) => e.value)).toEqual([170]);
  });

  it("keeps what tells a game apart through to the list", () => {
    const list = rankList(
      [{ playerId: "p", year: 2027, value: 9, gameId: "g", weekKey: "w4" }],
      [],
      "game",
      () => "",
    );
    expect(list[0]).toMatchObject({ rank: 1, gameId: "g", weekKey: "w4" });
  });
});

describe("shared ranks", () => {
  it("gives level entries the rank of the first", () => {
    const ranks = sharedRanks([{ n: 9 }, { n: 7 }, { n: 7 }, { n: 5 }], (e) => e.n).map((e) => e.rank);
    expect(ranks).toEqual([1, 2, 2, 4]);
  });
});

describe("fastest-to lists", () => {
  it("orders by games, then the earlier week, and shares a rank on level games", () => {
    const list = rankMarks([
      { gamesToReach: 9, weekKey: "w11", year: 2028 },
      { gamesToReach: 9, weekKey: "w9", year: 2029 },
      { gamesToReach: 12, weekKey: "w12", year: 2030 },
    ]);
    expect(list.map((m) => [m.year, m.rank])).toEqual([
      [2029, 1],
      [2028, 1],
      [2030, 3],
    ]);
  });

  it("keeps one line per mark per game, career first", () => {
    const mark = (horizon: PlayerMark["horizon"]) => ({
      statKey: "rushYds" as const,
      mark: 1000,
      horizon,
      gameId: "g",
    });
    expect(distinctMarks([mark("season"), mark("career")]).map((m) => m.horizon)).toEqual(["career"]);
  });
});

describe("streak dates and lists", () => {
  it("labels a game, a season and a run", () => {
    expect(streakPointLabel({ year: 2029, weekKey: "w3" })).toBe("2029 W3");
    expect(streakPointLabel({ year: 2029 })).toBe("2029");
    const span = streakSpanLabel({ year: 2029, weekKey: "w3" }, { year: 2030, weekKey: "w1" });
    expect(span).toBe("2029 W3 to 2030 W1");
    expect(streakSpanLabel({ year: 2029 }, { year: 2029 })).toBe("2029");
    expect(streakSpanLabel(undefined, undefined)).toBeNull();
  });

  it("ranks each kind apart and leaves out a kind nobody has", () => {
    const lists = rankRuns(
      [
        { key: "a", longest: 3 },
        { key: "b", longest: 9 },
        { key: "a", longest: 5 },
      ],
      [{ key: "a" }, { key: "c" }, { key: "b" }],
    );
    expect(lists.map((l) => [l.key, l.entries.map((e) => e.longest)])).toEqual([
      ["a", [5, 3]],
      ["b", [9]],
    ]);
  });
});

describe("where we rank", () => {
  const row = (statKey: string, rank: number, teamId: string | null) => ({ statKey, rank, teamId });

  it("counts the team's spots and keeps its best player per stat", () => {
    const summary = whereWeRank(
      [row("passYds", 1, "ne"), row("rushYds", 7, "ne"), row("rushYds", 4, "ne"), row("rushYds", 1, "mia")],
      "ne",
    );
    expect(summary).toMatchObject({ spots: 3, topFive: 2, leaders: 1 });
    expect(summary.best.map((b) => [b.statKey, b.rank])).toEqual([
      ["passYds", 1],
      ["rushYds", 4],
    ]);
  });

  it("is all zeros when nobody on the team made a list", () => {
    expect(whereWeRank([row("passYds", 1, null)], "ne")).toEqual({
      spots: 0,
      topFive: 0,
      leaders: 0,
      best: [],
    });
  });
});

describe("a player's timeline", () => {
  const milestone = (over: Partial<TimelineMilestone>): TimelineMilestone => ({
    key: "k",
    kind: "career_high",
    title: "Drake Maye: career-high 3 passing touchdowns",
    year: 2027,
    weekKey: "w3",
    gameId: "g1",
    ...over,
  });
  const mark: TimelineMark = {
    statKey: "passYds",
    mark: 1000,
    horizon: "career",
    gamesToReach: 3,
    gameId: "g2",
    weekKey: "w4",
    year: 2027,
    rank: 2,
  };

  it("merges both sources newest first, without his name on his own page", () => {
    const items = playerTimeline("Drake Maye", [milestone({})], [mark]);
    expect(items.map((i) => i.title)).toEqual(["1,000 passing yards", "Career-high 3 passing touchdowns"]);
    expect(items[0]?.detail).toBe("Career · in 3 games · #2 fastest");
  });

  it("takes marks from the stored list, not the feed's announcement of them", () => {
    const items = playerTimeline("Drake Maye", [milestone({ kind: "mark" })], []);
    expect(items).toEqual([]);
  });

  it("leaves the rank off past the top twenty", () => {
    const items = playerTimeline("Drake Maye", [], [{ ...mark, rank: null, gamesToReach: 1 }]);
    expect(items[0]?.detail).toBe("Career · in 1 game");
  });
});

import { describe, expect, test } from "vitest";
import type { WeekKey } from "../domain/calendar";
import {
  DEFAULT_QUESTION,
  describeQuestion,
  MAX_SCAN_SEASONS,
  parseQuestion,
  planQuestion,
  questionProblem,
  questionSearch,
  settleQuestion,
  type Question,
} from "./explorer";
import {
  answerFromLines,
  answerFromSeasons,
  rankAnswer,
  type ExplorerLine,
  type ExplorerRow,
} from "./explorerAnswers";
import type { SplitGame } from "./splits";

const ask = (over: Partial<Question>): Question => ({ ...DEFAULT_QUESTION, ...over });

describe("a question in a URL", () => {
  test("the default takes no parameters", () => {
    expect(questionSearch(DEFAULT_QUESTION)).toEqual({});
    expect(parseQuestion({})).toEqual(DEFAULT_QUESTION);
  });

  test("a full question survives the trip", () => {
    const q = settleQuestion(
      ask({
        scope: "span",
        statKey: "recTd",
        split: "vs:DAL",
        window: 3,
        position: "WR",
        fromYear: 2027,
        toYear: 2029,
        playerId: "p1",
      }),
    );
    expect(parseQuestion(questionSearch(q))).toEqual(q);
  });

  test("numbers typed into a URL arrive as strings and still read", () => {
    expect(parseQuestion({ scope: "span", stat: "recTd", window: "3" }).window).toBe(3);
    expect(parseQuestion({ from: "2028" }).fromYear).toBe(2028);
  });

  test("anything unrecognised falls back rather than failing", () => {
    expect(parseQuestion({ scope: "nope", stat: "nope", split: "nope", window: 7 })).toEqual(
      DEFAULT_QUESTION,
    );
    expect(parseQuestion({ scope: "mark", stat: "rushYds", mark: 3 }).mark).toBe(1000);
  });

  test("only the scope's own choices are kept", () => {
    expect(questionSearch(ask({ scope: "game", window: 3, mark: 5000 }))).toEqual({ scope: "game" });
  });
});

describe("settling a question", () => {
  test("a stat the scope has no list for moves to one it has", () => {
    expect(settleQuestion(ask({ scope: "mark", statKey: "fumbles" })).statKey).toBe("passYds");
  });

  test("a mark follows the stat", () => {
    expect(settleQuestion(ask({ scope: "mark", statKey: "rushTd", mark: 1000 })).mark).toBe(10);
  });

  test("minimum games only belong to season and career", () => {
    expect(settleQuestion(ask({ scope: "game", minGames: 4 })).minGames).toBe(0);
    expect(settleQuestion(ask({ scope: "season", minGames: 4 })).minGames).toBe(4);
  });
});

describe("what a server refuses outright", () => {
  test("unknown choices", () => {
    expect(questionProblem(ask({}))).toBeNull();
    expect(questionProblem({ ...ask({}), statKey: "nope" })).toContain("Unknown stat");
    expect(questionProblem(ask({ split: "nope" }))).toContain("Unknown split");
    expect(questionProblem(ask({ scope: "mark", statKey: "fumbles" }))).toContain("no mark");
    expect(questionProblem(ask({ scope: "mark", mark: 7 }))).toContain("No mark");
  });
});

describe("where an answer is read from", () => {
  const source = (q: Partial<Question>, seasons = 20) => planQuestion(ask(q), seasons);

  test("season and career rows need no game read, however wide", () => {
    expect(source({ scope: "season" })).toEqual({ source: "seasons" });
    expect(source({ scope: "career", position: "RB", split: "playoffs" })).toEqual({ source: "seasons" });
  });

  test("boards answer plain questions over all time", () => {
    expect(source({ scope: "span", statKey: "recTd" })).toEqual({ source: "board" });
    expect(source({ scope: "mark" })).toEqual({ source: "board" });
    expect(source({ scope: "game" })).toEqual({ source: "board" });
  });

  test("a mark's board is regular season, so a playoff mark reads games", () => {
    expect(source({ scope: "mark", split: "playoffs" }, 2)).toEqual({ source: "lines" });
  });

  test("a stat with no record board reads games", () => {
    expect(source({ scope: "game", statKey: "fumbles" }, 2)).toEqual({ source: "lines" });
  });

  test("anything narrower reads games, up to the limit", () => {
    expect(source({ scope: "season", split: "home" }, MAX_SCAN_SEASONS)).toEqual({ source: "lines" });
    expect(source({ scope: "game", position: "RB" }, MAX_SCAN_SEASONS)).toEqual({ source: "lines" });
    expect(source({ scope: "game", position: "RB" }, MAX_SCAN_SEASONS + 1)).toHaveProperty("refused");
  });

  test("one player is bounded by their own career", () => {
    expect(source({ scope: "game", split: "home", playerId: "p1" }, 40)).toEqual({ source: "lines" });
  });
});

describe("a question in words", () => {
  test("names what was asked", () => {
    expect(describeQuestion(ask({ scope: "game" }))).toBe("Most rushing yards in a game");
    expect(describeQuestion(ask({ scope: "season", statKey: "passRating" }))).toBe(
      "Highest passer rating in a season",
    );
    expect(describeQuestion(ask({ scope: "span", window: 3 }))).toBe("Most rushing yards in any 3 games");
    expect(describeQuestion(ask({ scope: "mark" }))).toBe("Fastest to 1,000 rushing yards");
  });

  test("adds what narrows it", () => {
    expect(
      describeQuestion(ask({ split: "home", position: "RB", fromYear: 2027, toYear: 2027, minGames: 5 })),
    ).toBe("Most rushing yards in a season · Home · RB · 2027 · at least 5 games");
    expect(describeQuestion(ask({ fromYear: 2027 }))).toContain("2027 to now");
  });
});

describe("answers", () => {
  const game = (n: number, over: Partial<SplitGame> = {}): SplitGame => ({
    gameId: `g${n}`,
    weekKey: `w${n}` as WeekKey,
    home: true,
    won: true,
    lost: false,
    margin: 7,
    division: false,
    conference: true,
    overtime: false,
    opponent: "BUF",
    ...over,
  });
  const line = (playerId: string, n: number, rushYds: number, year = 2027): ExplorerLine => ({
    playerId,
    gameId: `g${n}`,
    seasonId: `s${year}`,
    year,
    weekKey: `w${n}` as WeekKey,
    stats: { rushYds },
  });
  const games = new Map(
    [game(1), game(2, { home: false }), game(3), game(4), game(5, { weekKey: "wc" })].map((g) => [
      g.gameId,
      g,
    ]),
  );
  const lines = [
    line("a", 1, 100),
    line("a", 2, 90),
    line("a", 3, 80),
    line("b", 1, 120),
    line("b", 2, 0),
    line("b", 4, 40),
    line("b", 5, 200),
  ];
  const summary = (q: Partial<Question>) =>
    answerFromLines(ask(q), lines, games).rows.map((r) => [r.rank, r.playerId, r.value]);

  test("single games, regular season, zeros left off", () => {
    expect(summary({ scope: "game" })).toEqual([
      [1, "b", 120],
      [2, "a", 100],
      [3, "a", 90],
      [4, "a", 80],
      [5, "b", 40],
    ]);
  });

  test("a split narrows every scope", () => {
    expect(summary({ scope: "game", split: "away" })).toEqual([[1, "a", 90]]);
    expect(summary({ scope: "game", split: "playoffs" })).toEqual([[1, "b", 200]]);
    expect(summary({ scope: "season", split: "home" })).toEqual([
      [1, "a", 180],
      [2, "b", 160],
    ]);
  });

  test("seasons and careers add up per player, with the games counted", () => {
    const { rows } = answerFromLines(ask({ scope: "career" }), lines, games);
    expect(rows[0]).toMatchObject({ playerId: "a", value: 270, games: 3, when: "2027" });
  });

  test("minimum games drops the short rows", () => {
    expect(summary({ scope: "season", minGames: 4 })).toEqual([]);
    expect(summary({ scope: "season", minGames: 3 })).toEqual([
      [1, "a", 270],
      [2, "b", 160],
    ]);
  });

  test("spans run over the games asked about", () => {
    const { rows } = answerFromLines(ask({ scope: "span", window: 2 }), lines, games);
    expect(rows[0]).toMatchObject({ playerId: "a", value: 190, games: 2, when: "2027 W1 to 2027 W2" });
  });

  test("marks rank by fewest games", () => {
    const fast = [line("a", 1, 900), line("a", 2, 200), line("b", 1, 1100)];
    const answer = answerFromLines(ask({ scope: "mark", mark: 1000 }), fast, games);
    expect(answer.rows.map((r) => [r.rank, r.playerId, r.games])).toEqual([
      [1, "b", 1],
      [2, "a", 2],
    ]);
  });

  test("a season horizon counts each year afresh", () => {
    const years = [line("a", 1, 600), line("a", 2, 600, 2028)];
    const on = (horizon: Question["horizon"]) =>
      answerFromLines(ask({ scope: "mark", mark: 1000, horizon }), years, games).rows.length;
    expect(on("season")).toBe(0);
    expect(on("career")).toBe(1);
  });

  test("season rows answer without game lines", () => {
    const figures = [
      { playerId: "a", year: 2027, gamesPlayed: 17, totals: { rushYds: 1200 } },
      { playerId: "a", year: 2028, gamesPlayed: 3, totals: { rushYds: 300 } },
      { playerId: "b", year: 2027, gamesPlayed: 17, totals: { rushYds: 1300 } },
    ];
    expect(answerFromSeasons(ask({ scope: "career" }), figures).rows[0]).toMatchObject({
      playerId: "a",
      value: 1500,
      games: 20,
      when: "2027 to 2028",
    });
    expect(
      answerFromSeasons(ask({ scope: "season", minGames: 10 }), figures).rows.map((r) => r.value),
    ).toEqual([1300, 1200]);
  });

  test("level rows share a rank and the list is capped, the full count kept", () => {
    const rows: ExplorerRow[] = Array.from({ length: 60 }, (_, i) => ({
      key: String(i),
      playerId: String(i),
      value: 10,
      games: null,
      when: null,
      gameId: null,
    }));
    const answer = rankAnswer(rows);
    expect(answer.total).toBe(60);
    expect(answer.rows).toHaveLength(50);
    expect(new Set(answer.rows.map((r) => r.rank))).toEqual(new Set([1]));
  });
});

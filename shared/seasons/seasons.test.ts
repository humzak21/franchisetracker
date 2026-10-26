import { describe, expect, test } from "vitest";
import type { WeekKey } from "../domain";
import type { GameLike } from "../games/summary";
import {
  finishedPlayoffResult,
  isEliminated,
  laterStatus,
  nextSeasonAction,
  playoffResultFromGames,
  statusFromGames,
} from "./lifecycle";
import {
  duePrompts,
  isNeedOpen,
  isSnoozed,
  needKey,
  PROMPT_SNOOZE_MS,
  sortNeeds,
  type ReportPrompts,
} from "./reports";

const game = (weekKey: WeekKey, us: number, them: number): GameLike => ({
  weekKey,
  status: "played",
  userIsHome: true,
  homeScore: us,
  awayScore: them,
});

describe("season lifecycle", () => {
  test("status follows the games, and the Super Bowl closes the season", () => {
    expect(statusFromGames([])).toBe("upcoming");
    expect(statusFromGames([game("pre1", 10, 3)])).toBe("upcoming");
    expect(statusFromGames([game("w1", 21, 14)])).toBe("regular");
    expect(statusFromGames([game("w1", 21, 14), game("wc", 7, 24)])).toBe("postseason");
    expect(statusFromGames([game("sb", 31, 28)])).toBe("complete");
    expect(statusFromGames([{ weekKey: "w1", status: "scheduled" }])).toBe("upcoming");
  });

  test("never moves backwards", () => {
    expect(laterStatus("complete", "regular")).toBe("complete");
    expect(laterStatus("upcoming", "postseason")).toBe("postseason");
  });

  test("playoff result is the first loss, or the title", () => {
    expect(playoffResultFromGames([game("w18", 3, 0)])).toBeUndefined();
    expect(playoffResultFromGames([game("wc", 20, 10), game("div", 3, 17)])).toBe("div_loss");
    expect(playoffResultFromGames([game("conf", 27, 20), game("sb", 31, 28)])).toBe("champion");
    expect(playoffResultFromGames([game("sb", 10, 28)])).toBe("sb_loss");
    expect(isEliminated([game("wc", 20, 10)])).toBe(false);
    expect(isEliminated([game("wc", 10, 20)])).toBe(true);
  });

  test("finishing by hand keeps a known result and otherwise means no playoffs", () => {
    expect(finishedPlayoffResult([game("w17", 10, 3)], undefined)).toBe("missed");
    expect(finishedPlayoffResult([game("wc", 10, 30)], undefined)).toBe("wc_loss");
    expect(finishedPlayoffResult([], "conf_loss")).toBe("conf_loss");
  });

  test("season actions", () => {
    expect(nextSeasonAction("upcoming", false)).toBeNull();
    expect(nextSeasonAction("regular", false)).toBe("finish");
    expect(nextSeasonAction("postseason", true)).toBe("finish");
    expect(nextSeasonAction("complete", false)).toBe("advance");
    expect(nextSeasonAction("complete", true)).toBeNull();
  });
});

describe("report prompts", () => {
  const answered = { status: "answered" as const, answeredAt: 1 };
  const seasons = [
    { _id: "s24", year: 2024, status: "complete" as const },
    { _id: "s26", year: 2026, status: "complete" as const },
    { _id: "s27", year: 2027, status: "upcoming" as const },
  ];

  test("pre-season of the season being played and post-season of the one just finished", () => {
    expect(duePrompts(seasons, new Map(), 2026)).toEqual([
      { seasonId: "s26", year: 2026, prompt: "postseason", dismissedAt: undefined },
      { seasonId: "s27", year: 2027, prompt: "preseason", dismissedAt: undefined },
    ]);
  });

  test("answered prompts are done; dismissed ones are still due", () => {
    const prompts = new Map<string, ReportPrompts>([
      ["s26", { preseason: answered, postseason: answered }],
      ["s27", { preseason: { status: "pending", dismissedAt: 5 }, postseason: { status: "pending" } }],
    ]);
    expect(duePrompts(seasons, prompts, 2026)).toEqual([
      { seasonId: "s27", year: 2027, prompt: "preseason", dismissedAt: 5 },
    ]);
  });

  test("real NFL seasons before the franchise never ask for a report", () => {
    expect(duePrompts(seasons.slice(0, 1), new Map(), 2026)).toEqual([]);
  });

  test("a dismissed banner comes back after the snooze", () => {
    expect(isSnoozed({}, 100)).toBe(false);
    expect(isSnoozed({ dismissedAt: 100 }, 100 + PROMPT_SNOOZE_MS - 1)).toBe(true);
    expect(isSnoozed({ dismissedAt: 100 }, 100 + PROMPT_SNOOZE_MS)).toBe(false);
  });
});

describe("needs", () => {
  test("open until resolved by a transaction, a pick or a note", () => {
    expect(isNeedOpen({ key: "a", priority: "high" })).toBe(true);
    expect(isNeedOpen({ key: "a", priority: "high", resolvedByDraftPickId: "p" })).toBe(false);
    expect(isNeedOpen({ key: "a", priority: "high", resolvedAt: 3 })).toBe(false);
  });

  test("open first, then by priority, otherwise as written", () => {
    const needs = [
      { key: "a", priority: "low" as const },
      { key: "b", priority: "high" as const, resolvedAt: 1 },
      { key: "c", priority: "medium" as const },
      { key: "d", priority: "low" as const },
    ];
    expect(sortNeeds(needs).map((n) => n.key)).toEqual(["c", "a", "d", "b"]);
  });

  test("keys are unique within a report", () => {
    expect(needKey([], 10)).toBe("na");
    expect(needKey([{ key: "na" }], 10)).toBe("nb");
  });
});

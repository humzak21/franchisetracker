import { describe, expect, test } from "vitest";
import type { GameLike } from "../games/summary";
import { playerGoalFacts, teamGoalFacts } from "./goalFacts";
import { evaluateGoal, goalFraction, type GoalLike, type TeamFacts } from "./goals";
import { goalSpecError, goalTitle } from "./goalSpec";

const team = (over: Partial<TeamFacts> = {}): TeamFacts => ({
  year: 2026,
  status: "regular",
  regular: { w: 6, l: 3, t: 0 },
  divisionRank: null,
  seed: null,
  playoffResult: null,
  playoffGames: [],
  bye: false,
  ...over,
});

const goal = (type: GoalLike["type"], over: Partial<GoalLike> = {}): GoalLike => ({
  scope: "team",
  type,
  ...over,
});

const status = (g: GoalLike, f: TeamFacts) => evaluateGoal(g, f).status;

describe("team goals", () => {
  test("wins: hit as soon as reached, missed only once the regular season is over", () => {
    const wins = goal("wins", { target: 10 });
    expect(evaluateGoal(wins, team())).toMatchObject({
      status: "in_progress",
      progress: { current: 6, target: 10, better: "higher" },
    });
    expect(status(wins, team({ regular: { w: 10, l: 2, t: 0 } }))).toBe("hit");
    expect(status(wins, team({ status: "postseason", regular: { w: 9, l: 8, t: 0 } }))).toBe("missed");
    expect(status(wins, team({ status: "complete", regular: { w: 9, l: 8, t: 0 } }))).toBe("missed");
  });

  test("division: from the final rank or a division winner's seed", () => {
    const division = goal("division");
    expect(status(division, team({ divisionRank: 1 }))).toBe("in_progress");
    expect(status(division, team({ status: "postseason", divisionRank: 1 }))).toBe("hit");
    expect(status(division, team({ status: "postseason", seed: 3 }))).toBe("hit");
    expect(status(division, team({ status: "postseason", seed: 6 }))).toBe("missed");
    expect(status(division, team({ status: "complete", divisionRank: 2 }))).toBe("missed");
    expect(status(division, team({ status: "complete", playoffResult: "missed" }))).toBe("missed");
    // Older formats had three division winners among the seeds.
    expect(status(division, team({ year: 1995, status: "postseason", seed: 4 }))).toBe("missed");
    // In the playoffs but no rank or seed captured: the owner decides.
    expect(status(division, team({ status: "complete", playoffResult: "div_loss" }))).toBe("pending");
  });

  test("playoffs: a seed, a playoff game or a bye counts; missed when the season ends without one", () => {
    const playoffs = goal("playoffs");
    expect(status(playoffs, team())).toBe("in_progress");
    expect(status(playoffs, team({ seed: 5 }))).toBe("in_progress");
    expect(status(playoffs, team({ status: "postseason", seed: 5 }))).toBe("hit");
    expect(status(playoffs, team({ playoffGames: [{ round: "wc", won: false }] }))).toBe("hit");
    expect(status(playoffs, team({ status: "complete", playoffResult: "missed" }))).toBe("missed");
  });

  test("bye: the top seed since 2020, top two before", () => {
    const bye = goal("bye");
    expect(status(bye, team({ status: "postseason", seed: 1 }))).toBe("hit");
    expect(status(bye, team({ status: "postseason", seed: 2 }))).toBe("missed");
    expect(status(bye, team({ year: 2015, status: "postseason", seed: 2 }))).toBe("hit");
    expect(status(bye, team({ bye: true }))).toBe("hit");
    expect(status(bye, team({ playoffGames: [{ round: "wc", won: true }] }))).toBe("missed");
    expect(status(bye, team({ status: "complete", playoffResult: "missed" }))).toBe("missed");
    expect(status(bye, team())).toBe("in_progress");
  });

  test("playoff win, Super Bowl appearance and win follow the playoff run", () => {
    const won = team({ status: "postseason", playoffGames: [{ round: "wc", won: true }] });
    expect(status(goal("playoff_win"), won)).toBe("hit");
    expect(status(goal("super_bowl_appearance"), won)).toBe("in_progress");
    expect(status(goal("super_bowl_win"), won)).toBe("in_progress");

    const out = team({
      status: "postseason",
      playoffResult: "wc_loss",
      playoffGames: [{ round: "wc", won: false }],
    });
    expect(status(goal("playoff_win"), out)).toBe("missed");
    expect(status(goal("super_bowl_appearance"), out)).toBe("missed");

    const lostSb = team({ status: "complete", playoffResult: "sb_loss" });
    expect(status(goal("playoff_win"), lostSb)).toBe("hit");
    expect(status(goal("super_bowl_appearance"), lostSb)).toBe("hit");
    expect(status(goal("super_bowl_win"), lostSb)).toBe("missed");
    expect(status(goal("super_bowl_win"), team({ status: "complete", playoffResult: "champion" }))).toBe(
      "hit",
    );
    expect(status(goal("super_bowl_win"), team({ status: "complete", playoffResult: "missed" }))).toBe(
      "missed",
    );
  });

  test("write-ins wait for the owner; a manual outcome overrides the numbers", () => {
    expect(status(goal("custom", { text: "Beat Buffalo twice" }), team())).toBe("pending");
    expect(status(goal("custom", { outcome: "hit" }), team())).toBe("hit");
    const overridden = evaluateGoal(
      goal("wins", { target: 10, outcome: "missed" }),
      team({ regular: { w: 12, l: 0, t: 0 } }),
    );
    expect(overridden).toMatchObject({ status: "missed", manual: true, progress: { current: 12 } });
  });
});

describe("player stat goals", () => {
  const stat = (statKey: string, target: number): GoalLike => ({
    scope: "player",
    type: "stat",
    statKey,
    target,
  });
  const player = (totals: Record<string, number>, games = 9) => ({ totals, games });

  test("higher is better: hit once reached, missed if short at the end of the regular season", () => {
    const yards = stat("passYds", 4000);
    expect(evaluateGoal(yards, team(), player({ passYds: 2500 }))).toMatchObject({
      status: "in_progress",
      progress: { current: 2500, target: 4000 },
    });
    expect(evaluateGoal(yards, team(), player({ passYds: 4100 })).status).toBe("hit");
    expect(evaluateGoal(yards, team({ status: "complete" }), player({ passYds: 3900 })).status).toBe(
      "missed",
    );
    expect(evaluateGoal(yards, team(), null)).toMatchObject({
      status: "in_progress",
      progress: { current: 0 },
    });
  });

  test("lower is better: missed once over the limit, hit only when the regular season ends under it", () => {
    const ints = stat("passInt", 8);
    expect(evaluateGoal(ints, team(), player({ passInt: 5 }))).toMatchObject({
      status: "in_progress",
      onTrack: true,
      progress: { better: "lower" },
    });
    expect(evaluateGoal(ints, team(), player({ passInt: 9 })).status).toBe("missed");
    expect(evaluateGoal(ints, team({ status: "postseason" }), player({ passInt: 8 })).status).toBe("hit");
    // No interceptions recorded is zero, which is under the limit.
    expect(evaluateGoal(ints, team({ status: "complete" }), player({ passYds: 3000 })).status).toBe("hit");
  });

  test("rates are only settled at the end of the regular season", () => {
    const pct = stat("passCmpPct", 65);
    const hot = player({ passCmp: 70, passAtt: 100 });
    expect(evaluateGoal(pct, team(), hot)).toMatchObject({ status: "in_progress", onTrack: true });
    expect(evaluateGoal(pct, team({ status: "complete" }), hot).status).toBe("hit");
    expect(evaluateGoal(pct, team({ status: "complete" }), null)).toMatchObject({
      status: "missed",
      progress: { current: null },
    });
  });

  test("player write-ins are pending until marked", () => {
    expect(evaluateGoal({ scope: "player", type: "custom" }, team()).status).toBe("pending");
  });
});

describe("facts", () => {
  const game = (weekKey: GameLike["weekKey"], us: number, them: number): GameLike => ({
    weekKey,
    status: "played",
    userIsHome: true,
    homeScore: us,
    awayScore: them,
  });

  test("team facts read games, the standing and the record cache", () => {
    const facts = teamGoalFacts(
      { year: 2026, status: "postseason", userRecord: { seed: 4, divisionRank: 2 } },
      [game("w1", 21, 14), game("w2", 3, 10), game("wc", 27, 20), { weekKey: "w3", status: "bye" }],
      { divisionRank: 1 },
    );
    expect(facts).toMatchObject({
      regular: { w: 1, l: 1, t: 0 },
      divisionRank: 1,
      seed: 4,
      playoffResult: null,
      playoffGames: [{ round: "wc", won: true }],
      bye: false,
    });
    expect(
      teamGoalFacts({ year: 2026, status: "postseason" }, [{ weekKey: "wc", status: "bye" }], null).bye,
    ).toBe(true);
  });

  test("player facts sum log-derived regular-season rows across teams", () => {
    const row = (split: string, source: string, passYds: number, gamesPlayed: number) => ({
      split,
      source,
      gamesPlayed,
      totals: { passYds },
    });
    expect(
      playerGoalFacts([
        row("regular", "logs", 1000, 4),
        row("regular", "logs", 500, 2),
        row("postseason", "logs", 300, 1),
        row("regular", "import", 9000, 17),
      ]),
    ).toEqual({ totals: { passYds: 1500 }, games: 6 });
    expect(playerGoalFacts([row("postseason", "logs", 300, 1)])).toBeNull();
  });
});

describe("goal specs", () => {
  test("validates each kind of goal", () => {
    expect(goalSpecError({ scope: "team", type: "wins", hasPlayer: false, target: 11 })).toBeNull();
    expect(goalSpecError({ scope: "team", type: "wins", hasPlayer: false })).toMatch(/whole number/);
    expect(goalSpecError({ scope: "team", type: "wins", hasPlayer: false, target: 10.5 })).toMatch(
      /whole number/,
    );
    expect(goalSpecError({ scope: "team", type: "playoffs", hasPlayer: false })).toBeNull();
    expect(goalSpecError({ scope: "team", type: "playoffs", hasPlayer: false, target: 3 })).toMatch(/target/);
    expect(goalSpecError({ scope: "team", type: "stat", hasPlayer: false })).toMatch(/team goal/);
    expect(goalSpecError({ scope: "team", type: "custom", hasPlayer: false, text: "  " })).toMatch(/Write/);
    expect(
      goalSpecError({ scope: "player", type: "stat", hasPlayer: true, statKey: "passYds", target: 4500 }),
    ).toBeNull();
    expect(
      goalSpecError({ scope: "player", type: "stat", hasPlayer: false, statKey: "passYds", target: 1 }),
    ).toMatch(/player/);
    expect(
      goalSpecError({ scope: "player", type: "stat", hasPlayer: true, statKey: "nope", target: 1 }),
    ).toMatch(/stat/);
    expect(
      goalSpecError({ scope: "player", type: "stat", hasPlayer: true, statKey: "passYds", target: -1 }),
    ).toMatch(/target/);
    expect(goalSpecError({ scope: "player", type: "wins", hasPlayer: true, target: 3 })).toMatch(
      /stat or write/,
    );
    expect(goalSpecError({ scope: "player", type: "custom", hasPlayer: true, text: "Pro Bowl" })).toBeNull();
    expect(goalSpecError({ scope: "team", type: "custom", hasPlayer: false, text: "x".repeat(201) })).toMatch(
      /under/,
    );
  });

  test("titles read like sentences", () => {
    expect(goalTitle({ type: "wins", target: 11 })).toBe("Win at least 11 games");
    expect(goalTitle({ type: "stat", statKey: "passYds", target: 4500 })).toBe("Passing yards ≥ 4,500");
    expect(goalTitle({ type: "stat", statKey: "passInt", target: 8 })).toBe("Interceptions thrown ≤ 8");
    expect(goalTitle({ type: "super_bowl_win" })).toBe("Win the Super Bowl");
    expect(goalTitle({ type: "custom", text: "Sweep the division" })).toBe("Sweep the division");
  });

  test("progress bars fill toward the target", () => {
    expect(goalFraction({ current: 5, target: 10, better: "higher" })).toBe(0.5);
    expect(goalFraction({ current: 15, target: 10, better: "higher" })).toBe(1);
    expect(goalFraction({ current: null, target: 10, better: "higher" })).toBe(0);
    expect(goalFraction({ current: 0, target: 0, better: "lower" })).toBe(0);
  });
});

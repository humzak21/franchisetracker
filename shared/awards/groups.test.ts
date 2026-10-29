import { describe, expect, test } from "vitest";
import { coachKey, findBankCoach, NFL_HEAD_COACHES, searchCoaches } from "../domain/coaches";
import { findTeamSeed } from "../domain/teams";
import {
  allPro,
  awardWeeks,
  conferenceOf,
  conferenceSlots,
  leagueSlots,
  proBowl,
  splitFilled,
  weekWinners,
  weeklyGaps,
} from "./groups";

const awards = [
  { type: "OPOW" as const, weekKey: "w2" as const, conference: "AFC" as const, scope: "conference" as const },
  { type: "DPOW" as const, weekKey: "w1" as const, conference: "NFC" as const, scope: "conference" as const },
  { type: "MVP" as const, scope: "league" as const },
  { type: "OPOY" as const, scope: "conference" as const, conference: "NFC" as const },
  // Imported before conferences were stored: the team tells.
  { type: "DPOY" as const, scope: "league" as const, team: { abbr: "PIT" } },
  { type: "CPOY" as const, scope: "league" as const },
  { type: "AllPro1" as const, position: "WR" as const, scope: "league" as const },
  { type: "AllPro1" as const, position: "QB" as const, scope: "league" as const },
  {
    type: "ProBowl" as const,
    conference: "NFC" as const,
    position: "CB" as const,
    scope: "conference" as const,
  },
];

describe("season awards", () => {
  test("league awards stand apart, conference awards split AFC and NFC", () => {
    const league = splitFilled(leagueSlots(awards, ["MVP", "COY", "SBMVP"]));
    expect(league.filled.map((s) => s.type)).toEqual(["MVP"]);
    expect(league.empty.map((s) => s.type)).toEqual(["COY", "SBMVP"]);

    const { conferences, unplaced } = conferenceSlots(awards);
    const filled = conferences.map((c) => [c.conference, splitFilled(c.slots).filled.map((s) => s.type)]);
    expect(filled).toEqual([
      ["AFC", ["DPOY"]],
      ["NFC", ["OPOY"]],
    ]);
    expect(unplaced.map((a) => a.type)).toEqual(["CPOY"]);
  });

  test("a stored conference wins over the team's", () => {
    expect(conferenceOf({ type: "OPOY", scope: "conference", conference: "NFC", team: { abbr: "KC" } })).toBe(
      "NFC",
    );
    expect(conferenceOf({ type: "OPOY", scope: "league", team: { abbr: "KC" } })).toBe("AFC");
    expect(conferenceOf({ type: "OPOY", scope: "league" })).toBeUndefined();
  });

  test("All-Pro in depth-chart order, Pro Bowl per conference", () => {
    expect(allPro(awards)[0]!.players.map((p) => p.position)).toEqual(["QB", "WR"]);
    expect(proBowl(awards).map((g) => g.players.length)).toEqual([0, 1]);
  });
});

describe("weekly awards", () => {
  test("weeks in order and each week's winners per conference", () => {
    expect(awardWeeks(awards)).toEqual(["w1", "w2"]);
    expect(weekWinners(awards, "w2")[0]!.awards[0]!.winners).toHaveLength(1);
  });

  test("gaps list every slot of a week not captured", () => {
    const gaps = weeklyGaps(awards);
    expect(gaps).toHaveLength(18);
    expect(gaps[0]).toMatchObject({ week: "w1" });
    expect(gaps[0]!.missing).toHaveLength(7);
    expect(gaps[0]!.missing).not.toContainEqual({ conference: "NFC", type: "DPOW" });
    expect(gaps[2]!.missing).toHaveLength(8);
  });
});

describe("coach bank", () => {
  test("names are unique and every team is a real one", () => {
    const keys = NFL_HEAD_COACHES.map((c) => coachKey(c.name));
    expect(new Set(keys).size).toBe(keys.length);
    for (const coach of NFL_HEAD_COACHES) {
      for (const abbr of coach.teams) expect(findTeamSeed(abbr), `${coach.name} ${abbr}`).toBeDefined();
    }
  });

  test("finds a coach however the name is typed", () => {
    expect(findBankCoach("  andy   REID ")?.name).toBe("Andy Reid");
    expect(findBankCoach("Kevin OConnell")?.name).toBe("Kevin O'Connell");
    expect(findBankCoach("Coach Prime")).toBeUndefined();
  });

  test("search puts created coaches first", () => {
    const created = [{ name: "Coach Mcvay Fan", teams: [] }];
    expect(searchCoaches(created, "mcvay").map((c) => c.name)).toEqual(["Coach Mcvay Fan", "Sean McVay"]);
    expect(searchCoaches([], "", 3)).toHaveLength(3);
  });
});

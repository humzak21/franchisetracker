/** Extraction normalizers and validators for the people screens: awards, the draft, moves, injuries, rosters. */
import { describe, expect, test } from "vitest";
import { mergeFor, normalizeFor, validateDraft, type RowTargetKey } from "../targets";
import type { RowTargetDraft } from "../types";
import { draftResultsSpec, rowOverallPick } from "./peopleSpecs";

const sure = { confidence: 0.95, unclear_fields: [] };
const read = (target: RowTargetKey, raw: unknown) => normalizeFor(target, raw).draft as RowTargetDraft;
const messages = (draft: RowTargetDraft) => validateDraft(draft).map((w) => w.message);

describe("awards", () => {
  test("weekly awards resolve the award and conference; two winners of one slot is a misread", () => {
    const draft = read("weekly_awards", {
      rows: [
        {
          award: "OPOW",
          conference: "AFC",
          name: "Drake Maye",
          team: "NE",
          position: "QB",
          stat_line: "3 TD",
          ...sure,
        },
        { award: "OPOW", conference: "AFC", name: "Josh Allen", team: "BUF", position: "QB", ...sure },
        { award: "DPOW", conference: "NFC", name: "Micah Parsons", team: "GB", position: "LB", ...sure },
      ],
    });
    expect(draft.rows.map((r) => [r.values.award, r.values.conference, r.teamAbbr])).toEqual([
      ["OPOW", "AFC", "NE"],
      ["OPOW", "AFC", "BUF"],
      ["DPOW", "NFC", "GB"],
    ]);
    expect(draft.rows[0]!.values.statLine).toBe("3 TD");
    expect(messages(draft)).toContain("Offensive Player of the Week: 2 winners in one slot");
  });

  test("honors such as the Pro Bowl have many winners; MVP has one", () => {
    const draft = read("yearly_awards", {
      rows: [
        { award: "ProBowl", conference: "AFC", name: "Drake Maye", team: "NE", position: "QB", ...sure },
        { award: "ProBowl", conference: "AFC", name: "Josh Allen", team: "BUF", position: "QB", ...sure },
        { award: "MVP", name: "Drake Maye", team: "NE", position: "QB", ...sure },
        { award: "MVP", name: "Josh Allen", team: "BUF", position: "QB", ...sure },
      ],
    });
    const warnings = messages(draft);
    expect(warnings.some((m) => m.includes("Pro Bowl"))).toBe(false);
    expect(warnings.some((m) => m.includes("2 winners in one slot"))).toBe(true);
  });
});

describe("the draft", () => {
  const shot = (rows: unknown[]) => normalizeFor("draft_results", { rows }) as never;
  const pick = (round: number, pickInRound: number, name: string, extra: object = {}) => ({
    round,
    pick_in_round: pickInRound,
    name,
    position: "HB",
    ...sure,
    ...extra,
  });

  test("picks merge by the overall pick worked out from round and pick, and need a team", () => {
    const merged = mergeFor("draft_results", [
      shot([pick(1, 12, "Will Campbell", { team: "NE" })]),
      shot([pick(1, 12, "Will Campbell", { team: "NE" }), pick(2, 6, "TreVeyon Henderson")]),
    ]);
    const draft = merged.draft as RowTargetDraft;
    expect(draft.rows.map((r) => rowOverallPick(r))).toEqual([12, 38]);
    expect(draft.rows.map((r) => draftResultsSpec.caption?.(r))).toEqual([
      "No. 12 overall",
      "No. 38 overall",
    ]);
    expect(messages(draft)).toContain("TreVeyon Henderson: pick the team");
  });

  test("the screen with a pick highlighted gives his full name, age and college", () => {
    const list = [pick(1, 7, "C.Coleman", { team: "NE" }), pick(4, 32, "M.Hawkins", { team: "NE" })];
    const merged = mergeFor("draft_results", [
      shot(list),
      shot([
        list[0],
        pick(4, 32, "Marcellous Hawkins", { team: "NE", age: 22, college: "Virginia Tech", ovr: 68 }),
      ]),
    ]);
    const draft = merged.draft as RowTargetDraft;
    expect(draft.rows.map((r) => r.name)).toEqual(["C.Coleman", "Marcellous Hawkins"]);
    expect(draft.rows[1]!.values).toMatchObject({ age: 22, college: "Virginia Tech", ovr: 68 });
    expect(draft.rows.every((r) => r.match?.status === "new")).toBe(true);
  });

  test("a pick that is no draft slot cannot commit", () => {
    const draft = read("draft_results", { rows: [pick(2, 90, "Off Slot", { team: "NE" })] });
    expect(messages(draft)).toContain("Off Slot: round 2, pick 90 is not a draft slot");
  });
});

describe("moves and injuries", () => {
  test("transactions read the move, week and other team; the same move on two screens is one row", () => {
    const shot = (rows: unknown[]) => normalizeFor("transactions", { rows }) as never;
    const row = {
      type: "trade",
      week: "w3",
      name: "Stefon Diggs",
      team: "NE",
      counterpart: "Dolphins",
      ...sure,
    };
    const draft = mergeFor("transactions", [shot([row]), shot([row])]).draft as RowTargetDraft;
    expect(draft.rows).toHaveLength(1);
    expect(draft.rows[0]!.values).toMatchObject({ type: "trade", week: "w3", counterpart: "MIA" });
  });

  test("an injury needs its injury; IR and weeks out are typed", () => {
    const draft = read("injury_report", {
      rows: [
        {
          name: "Hunter Henry",
          team: "NE",
          position: "TE",
          injury: "High ankle sprain",
          length: "2-4 weeks",
          weeks: 3,
          ir: true,
          ...sure,
        },
        { name: "Kyle Dugger", team: "NE", position: "SS", injury: null, ...sure },
      ],
    });
    expect(draft.rows[0]!.values).toMatchObject({ injury: "High ankle sprain", weeks: 3, ir: true });
    expect(messages(draft)).toContain("Kyle Dugger: injury is missing");
  });
});

describe("rosters and cards", () => {
  test("a roster page needs its team; rows keep jersey, OVR and dev trait", () => {
    const draft = read("roster_page", {
      team: null,
      rows: [
        {
          name: "Christian Gonzalez",
          position: "CB",
          jersey: 0,
          ovr: 85,
          age: 23,
          exp: 2,
          dev_trait: "star",
          ...sure,
        },
      ],
    });
    expect(draft.rows[0]!.values).toMatchObject({ jersey: 0, ovr: 85, devTrait: "star" });
    expect(messages(draft)).toContain("Team is missing");
    const withTeam = read("roster_page", {
      team: "Patriots",
      rows: [{ name: "Christian Gonzalez", ovr: 85, ...sure }],
    });
    expect(withTeam.meta).toMatchObject({ team: "NE" });
  });

  test("a player card is one row with height, contract and abilities", () => {
    const draft = read("player_card", {
      rows: [
        {
          name: "Drake Maye",
          team: "NE",
          position: "QB",
          ovr: 84,
          age: 23,
          height_in: 76,
          contract_apy: 9_200_000,
          abilities: "Pocket Deadeye, Fearless",
          ...sure,
        },
      ],
    });
    expect(draft.rows[0]!.values).toMatchObject({
      heightIn: 76,
      contractApy: 9_200_000,
      abilities: "Pocket Deadeye, Fearless",
    });
  });
});

/** Extraction normalizers and validators for the people screens: awards, the draft, moves, injuries, rosters. */
import { describe, expect, test } from "vitest";
import { mergeFor, normalizeFor, validateDraft } from "../targets";
import type { RowTargetDraft, RowTargetKey } from "../types";

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
  test("an accepted pick needs a team, and picks merge by overall number across screenshots", () => {
    const shot = (rows: unknown[]) => normalizeFor("draft_results", { rows }) as never;
    const merged = mergeFor("draft_results", [
      shot([{ round: 1, overall: 12, name: "Will Campbell", team: "NE", position: "LT", ...sure }]),
      shot([
        { round: 1, overall: 12, name: "Will Campbell", team: "NE", position: "LT", ...sure },
        { round: 2, overall: 38, name: "TreVeyon Henderson", position: "HB", ...sure },
      ]),
    ]);
    const draft = merged.draft as RowTargetDraft;
    expect(draft.rows.map((r) => r.values.overall)).toEqual([12, 38]);
    expect(messages(draft)).toContain("Pick 38: pick the team");
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

import { validateDraft } from "@shared/ingestion/targets";
import { describe, expect, it } from "vitest";
import type { BoxScoreDraft, RowTargetDraft, TeamStatsDraft } from "@shared/ingestion/types";
import {
  attentionItems,
  choosePlayerAt,
  confirmNewLines,
  fieldLabel,
  getAt,
  parseStat,
  pickerContext,
  setAt,
  undecidedNewLines,
} from "./draftEdit";

const draft: BoxScoreDraft = {
  target: "game_box_score",
  game: { homeAbbr: "NE", awayAbbr: "LV", homeScore: 31, awayScore: 17, overtime: false, lineScore: null },
  lines: [
    {
      id: "ne-d-maye",
      teamAbbr: "NE",
      name: "D. Maye",
      position: "QB",
      stats: { passYds: 284, passTd: 3 },
      playerId: null,
      match: { status: "matched", candidates: [] },
    },
  ],
};

describe("draft paths", () => {
  it("reads and writes by line id without mutating", () => {
    expect(getAt(draft, "lines.ne-d-maye.stats.passYds")).toBe(284);
    const next = setAt(draft, "lines.ne-d-maye.stats.passYds", 290);
    expect(getAt(next, "lines.ne-d-maye.stats.passYds")).toBe(290);
    expect(getAt(draft, "lines.ne-d-maye.stats.passYds")).toBe(284);
    expect(getAt(setAt(draft, "game.homeScore", 30), "game.homeScore")).toBe(30);
  });

  it("clears a stat with undefined and indexes team columns", () => {
    const cleared = setAt(draft, "lines.ne-d-maye.stats.passTd", undefined);
    expect(cleared.lines[0]?.stats).toEqual({ passYds: 284 });
    const teams: TeamStatsDraft = {
      target: "team_game_stats",
      game: draft.game,
      teams: [{ teamAbbr: "NE", stats: { passYds: 284, rushYds: 116 } }],
    };
    expect(getAt(setAt(teams, "teams.0.stats.passYds", 284), "teams.0.stats.totalYds")).toBe(400);
  });

  it("labels fields for people", () => {
    expect(fieldLabel(draft, "lines.ne-d-maye.stats.passYds")).toBe("D. Maye · Passing yards");
    expect(fieldLabel(draft, "game.awayScore")).toBe("Away score");
  });
});

describe("attentionItems", () => {
  it("lists errors first, then low confidence, and skips removed lines", () => {
    const items = attentionItems(
      draft,
      [
        { path: "lines.ne-d-maye.stats.passYds", value: 0.4 },
        { path: "lines.ne-d-maye.stats.passTd", value: 0.95 },
        { path: "lines.gone.stats.rec", value: 0.1 },
        { path: "game.homeScore", value: 0.7 },
      ],
      [{ path: "game.awayScore", message: "Away score is off", severity: "error" }],
    );
    expect(items.map((i) => i.path)).toEqual([
      "game.awayScore",
      "lines.ne-d-maye.stats.passYds",
      "game.homeScore",
    ]);
  });
});

describe("parseStat", () => {
  it("clears on empty and ignores junk", () => {
    expect(parseStat("")).toBeUndefined();
    expect(parseStat(" 1.5 ")).toBe(1.5);
    expect(parseStat("abc")).toBeNull();
  });
});

describe("combined game review", () => {
  it("recomputes offensive yards after edits and ignores a manually supplied total", () => {
    const combined = {
      ...draft,
      target: "game_log" as const,
      teams: [{ teamAbbr: "NE", stats: { passYds: 284, rushYds: 128, totalYds: 500 } }],
    };
    const changed = setAt(combined, "teams.0.stats.passYds", 300);
    expect(changed.teams[0]?.stats.totalYds).toBe(428);
    expect(setAt(changed, "teams.0.stats.totalYds", 999).teams[0]?.stats.totalYds).toBe(428);
    expect(setAt(changed, "teams.0.stats.rushYds", undefined).teams[0]?.stats.totalYds).toBeUndefined();
    expect(fieldLabel(combined, "lines.ne-d-maye.stats.passYds")).toBe("D. Maye · Passing yards");
    expect(fieldLabel(combined, "teams.0.stats.totalYds")).toBe("NE · Total yards");
  });

  it("applies a recommended value and resolves the warning without retyping", () => {
    const wrongScore = {
      ...draft,
      game: { ...draft.game, homeScore: 30, lineScore: { home: [7, 14, 3, 7], away: [3, 7, 0, 7] } },
    };
    const warning = validateDraft(wrongScore).find((w) => w.path === "game.homeScore")!;
    expect(warning.suggestedValue).toBe(31);
    const corrected = setAt(wrongScore, warning.path!, warning.suggestedValue);
    expect(corrected.game.homeScore).toBe(31);
    expect(validateDraft(corrected).some((w) => w.path === warning.path)).toBe(false);
  });

  it("a chosen player clears ambiguity, preserving the printed name", () => {
    const chosen = choosePlayerAt(draft, "lines.ne-d-maye", {
      kind: "player",
      _id: "maye",
      name: "Drake Maye",
    });
    expect(chosen.lines[0]).toMatchObject({
      name: "D. Maye",
      playerId: "maye",
      match: { status: "matched", candidates: [{ playerId: "maye", name: "Drake Maye", score: 1 }] },
    });
    expect(
      choosePlayerAt(chosen, "lines.ne-d-maye", { kind: "new", name: "D. Maye" }).lines[0],
    ).toMatchObject({
      playerId: null,
      match: { status: "new" },
    });
    expect(draft.lines[0]?.playerId).toBeNull();
  });

  it("a new player takes the name typed for him", () => {
    const typed = choosePlayerAt(draft, "lines.ne-d-maye", { kind: "new", name: "Drake Maye" });
    expect(typed.lines[0]).toMatchObject({ name: "Drake Maye", playerId: null, match: { status: "new" } });
  });

  it("a college prospect becomes a new player with his ESPN id, school and position", () => {
    const pick: RowTargetDraft = {
      target: "draft_results",
      meta: {},
      rows: [
        {
          id: "128",
          accepted: true,
          name: "M.Hawkins",
          teamAbbr: "NE",
          values: { round: 4, pickInRound: 32 },
          playerId: null,
          match: { status: "new", candidates: [] },
        },
      ],
    };
    const prospect = choosePlayerAt(pick, "rows.128", {
      kind: "prospect",
      espnId: 4567,
      name: "Marcellous Hawkins",
      position: "HB",
      college: "Virginia Tech",
    });
    expect(prospect.rows[0]).toMatchObject({
      name: "Marcellous Hawkins",
      playerId: null,
      values: { round: 4, pickInRound: 32, espnId: 4567, college: "Virginia Tech", position: "HB" },
    });
    // Changing course to a plain new player drops the ESPN id.
    const plain = choosePlayerAt(prospect, "rows.128", { kind: "new", name: "Marcellous Hawkins" });
    expect(plain.rows[0]?.values).not.toHaveProperty("espnId");
  });
});

describe("deciding on a name", () => {
  const undecided: BoxScoreDraft = {
    ...draft,
    lines: [
      {
        id: "lv-a",
        teamAbbr: "LV",
        name: "A. Newman",
        position: "WR",
        stats: { rec: 2 },
        playerId: null,
        match: { status: "new", candidates: [] },
      },
      {
        id: "lv-b",
        teamAbbr: "LV",
        name: "B. Moore",
        position: "WR",
        stats: { rec: 1 },
        playerId: null,
        match: { status: "ambiguous", candidates: [{ playerId: "x", name: "Bob Moore", score: 0.8 }] },
      },
    ],
  };

  it("records creating a new player, and picking someone clears it", () => {
    const created = choosePlayerAt(undecided, "lines.lv-a", { kind: "new", name: "A. Newman" });
    expect(created.lines[0]?.confirmedNew).toBe(true);
    const picked = choosePlayerAt(created, "lines.lv-a", { kind: "player", _id: "y", name: "Al Newman" });
    expect(picked.lines[0]?.confirmedNew).toBeUndefined();
  });

  it("creates every unknown name at once and leaves unsettled ones to be picked", () => {
    expect(undecidedNewLines(undecided).map((l) => l.id)).toEqual(["lv-a"]);
    const lines = confirmNewLines(undecided).lines;
    expect(lines.map((l) => l.confirmedNew)).toEqual([true, undefined]);
    expect(undecidedNewLines({ ...undecided, lines })).toEqual([]);
  });
});

describe("pickerContext", () => {
  it("reads a line's team and position, and a row's from its values or the screen's team", () => {
    expect(pickerContext(draft, "lines.ne-d-maye")).toEqual({ teamAbbr: "NE", position: "QB" });
    const roster: RowTargetDraft = {
      target: "roster_page",
      meta: { team: "BUF" },
      rows: [
        {
          id: "r1",
          accepted: true,
          name: "J. Allen",
          teamAbbr: null,
          values: { position: "QB" },
          playerId: null,
          match: { status: "new", candidates: [] },
        },
      ],
    };
    expect(pickerContext(roster, "rows.r1")).toEqual({ teamAbbr: "BUF", position: "QB" });
  });
});

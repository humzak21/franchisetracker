import { describe, expect, it } from "vitest";
import type { BoxScoreDraft, TeamStatsDraft } from "@shared/ingestion/types";
import { attentionItems, fieldLabel, getAt, parseStat, setAt } from "./draftEdit";

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
      teams: [{ teamAbbr: "NE", stats: {} }],
    };
    expect(getAt(setAt(teams, "teams.0.stats.totalYds", 400), "teams.0.stats.totalYds")).toBe(400);
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

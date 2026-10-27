import { validateDraft } from "@shared/ingestion/targets";
import { describe, expect, it } from "vitest";
import type { BoxScoreDraft, TeamStatsDraft } from "@shared/ingestion/types";
import { attentionItems, choosePlayerAt, fieldLabel, getAt, parseStat, setAt } from "./draftEdit";

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
    const chosen = choosePlayerAt(draft, "lines.ne-d-maye", { _id: "maye", name: "Drake Maye" });
    expect(chosen.lines[0]).toMatchObject({
      name: "D. Maye",
      playerId: "maye",
      match: { status: "matched", candidates: [{ playerId: "maye", name: "Drake Maye", score: 1 }] },
    });
    expect(choosePlayerAt(chosen, "lines.ne-d-maye", null).lines[0]).toMatchObject({
      playerId: null,
      match: { status: "new" },
    });
    expect(draft.lines[0]?.playerId).toBeNull();
  });
});

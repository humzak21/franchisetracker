import { describe, expect, test } from "vitest";
import { emptyHeader, emptyRow, manualId, newLine } from "./manual";
import { emptyDraft, isRowDraft, rowTarget, TARGET_KEYS, validateDraft } from "./targets";
import type { GameHeader, RowTargetDraft } from "./types";

const GAME: GameHeader = { ...emptyHeader("NE"), awayAbbr: "BUF", homeScore: 24, awayScore: 21 };

describe("empty drafts", () => {
  test("every target has an empty draft of its own kind", () => {
    for (const target of TARGET_KEYS) {
      const draft = emptyDraft(target, { userTeamAbbr: "NE", game: null });
      expect(draft.target).toBe(target);
      if (isRowDraft(draft)) expect(draft.rows).toEqual([]);
    }
  });

  test("a game target starts from the game's header, or the user's team at home", () => {
    expect(emptyDraft("game_box_score", { userTeamAbbr: "NE", game: GAME })).toEqual({
      target: "game_box_score",
      game: GAME,
      lines: [],
    });
    const fresh = emptyDraft("game_box_score", { userTeamAbbr: "NE", game: null });
    expect("game" in fresh && fresh.game).toMatchObject({ homeAbbr: "NE", awayAbbr: null, homeScore: null });
  });

  test("team game stats get one empty column per team, away first", () => {
    const draft = emptyDraft("team_game_stats", { userTeamAbbr: "NE", game: GAME });
    expect(draft.target === "team_game_stats" && draft.teams).toEqual([
      { teamAbbr: "BUF", stats: {} },
      { teamAbbr: "NE", stats: {} },
    ]);
  });

  test("screen fields that name a team start as the user's team; the rest are empty", () => {
    const roster = emptyDraft("roster_page", { userTeamAbbr: "NE", game: null }) as RowTargetDraft;
    expect(roster.meta).toEqual({ team: "NE", partial: null });
    const leaders = emptyDraft("league_leaders", { userTeamAbbr: "NE", game: null }) as RowTargetDraft;
    expect(leaders.meta).toEqual({ stat: null });
  });

  test("an empty list cannot be committed; an empty box score with a final score can", () => {
    const awards = emptyDraft("yearly_awards", { userTeamAbbr: "NE", game: null });
    expect(validateDraft(awards).filter((w) => w.severity === "error")).toHaveLength(1);
    const box = emptyDraft("game_box_score", { userTeamAbbr: "NE", game: GAME });
    expect(validateDraft(box).filter((w) => w.severity === "error")).toEqual([]);
  });
});

describe("new rows and lines", () => {
  test("a new row is accepted, carries every field empty, and needs its required ones", () => {
    const draft = emptyDraft("yearly_awards", { userTeamAbbr: "NE", game: null }) as RowTargetDraft;
    const { spec } = rowTarget("yearly_awards");
    const row = emptyRow(spec, draft, { name: "Drake Maye", playerId: "p1", position: "QB" });
    expect(row).toMatchObject({
      id: "new-1",
      accepted: true,
      name: "Drake Maye",
      playerId: "p1",
      values: { award: null, conference: null, position: "QB", statLine: null },
      match: { status: "matched", candidates: [{ playerId: "p1", name: "Drake Maye", score: 1 }] },
    });
    const withRow = { ...draft, rows: [row] };
    expect(validateDraft(withRow).map((w) => w.message)).toContain("Drake Maye: award is missing");
    withRow.rows[0] = { ...row, values: { ...row.values, award: "MVP" } };
    expect(validateDraft(withRow).filter((w) => w.severity === "error")).toEqual([]);
  });

  test("rows that are not players have no name or match; a new player has no candidates", () => {
    const standings = emptyDraft("standings", { userTeamAbbr: "NE", game: null }) as RowTargetDraft;
    expect(emptyRow(rowTarget("standings").spec, standings)).toMatchObject({ name: null, match: null });
    const awards = emptyDraft("weekly_awards", { userTeamAbbr: "NE", game: null }) as RowTargetDraft;
    expect(emptyRow(rowTarget("weekly_awards").spec, awards, { name: "New Guy" }).match).toEqual({
      status: "new",
      candidates: [],
    });
  });

  test("season stat rows offer every stat", () => {
    const draft = emptyDraft("season_player_stats", { userTeamAbbr: "NE", game: null }) as RowTargetDraft;
    const { spec } = rowTarget("season_player_stats");
    const withRow = { ...draft, rows: [emptyRow(spec, draft, { name: "A" })] };
    expect(spec.fields(withRow).length).toBe(spec.fields().length);
  });

  test("a new line has no stats and a fresh id", () => {
    const first = newLine([], { name: "D. Maye", teamAbbr: "NE", position: "QB" });
    const second = newLine([first], { name: "S. Diggs" });
    expect(first).toMatchObject({ id: "new-1", stats: {}, teamAbbr: "NE", playerId: null });
    expect(second).toMatchObject({ id: "new-2", teamAbbr: null, position: null });
  });

  test("ids skip ones already taken", () => {
    expect(manualId(["new-1", "new-3"])).toBe("new-2");
    expect(manualId(["maye"])).toBe("new-1");
  });
});

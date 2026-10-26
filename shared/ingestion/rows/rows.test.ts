import { describe, expect, test } from "vitest";
import { diffDrafts } from "../diff";
import { reconcile, weeksWithoutBoxScore } from "../reconcile";
import { mergeFor, normalizeFor, schemaFor, validateDraft } from "../targets";
import type { RowTargetDraft } from "../types";
import { usageByModel } from "../usage";

const sure = { confidence: 0.95, unclear_fields: [] };

describe("row targets", () => {
  test("schemas carry screen fields and a rows list, or a list per stats tab", () => {
    expect(Object.keys(schemaFor("league_leaders").properties ?? {})).toEqual(["stat", "rows"]);
    const leader = schemaFor("league_leaders").properties?.rows?.items?.properties ?? {};
    expect(Object.keys(leader)).toEqual(["name", "team", "rank", "value", "confidence", "unclear_fields"]);
    expect(Object.keys(schemaFor("season_player_stats").properties ?? {})).toContain("defense");
    expect(schemaFor("standings").properties?.rows?.items?.properties?.division_rank?.type).toEqual([
      "integer",
      "null",
    ]);
  });

  test("normalizing reads typed fields, resolves teams and enums, and accepts only sure rows", () => {
    const { draft, warnings } = normalizeFor("league_leaders", {
      stat: "Passing Yards",
      rows: [
        { rank: 1, name: "J. Allen", team: "Bills", value: 1620, ...sure },
        { rank: 2.0, name: "D. Maye", team: "NE", value: "lots", confidence: 0.9, unclear_fields: ["value"] },
        { rank: 3, name: "", team: "KC", value: 1398, ...sure },
      ],
    }) as { draft: RowTargetDraft; warnings: unknown[] };
    expect(draft.meta).toEqual({ stat: "passYds" });
    expect(draft.rows.map((r) => [r.name, r.teamAbbr, r.values.value ?? null, r.accepted])).toEqual([
      ["J. Allen", "BUF", 1620, true],
      ["D. Maye", "NE", null, false],
    ]);
    expect(warnings).toEqual([]);
  });

  test("a player on two stats tabs is one row", () => {
    const { draft } = normalizeFor("season_player_stats", {
      passing: [{ name: "D. Maye", team: "NE", position: "QB", games_played: 6, pass_yds: 1450, ...sure }],
      rushing: [{ name: "D. Maye", team: "NE", position: "QB", games_played: 6, rush_yds: 120, ...sure }],
    }) as { draft: RowTargetDraft };
    expect(draft.rows).toHaveLength(1);
    expect(draft.rows[0]!.values).toEqual({ position: "QB", gamesPlayed: 6, passYds: 1450, rushYds: 120 });
  });

  test("merge is the union of rows; disagreements are flagged", () => {
    const shot = (rows: unknown[]) => normalizeFor("standings", { rows }) as never;
    const merged = mergeFor("standings", [
      shot([
        { team: "NE", w: 4, l: 1, ...sure },
        { team: "BUF", w: 3, l: 2, ...sure },
      ]),
      shot([
        { team: "BUF", w: 3, l: 2, ...sure },
        { team: "MIA", w: 2, l: 3, ...sure },
        { team: "NE", w: 5, l: 1, ...sure },
      ]),
    ]);
    const draft = merged.draft as RowTargetDraft;
    expect(draft.rows.map((r) => r.teamAbbr)).toEqual(["NE", "BUF", "MIA"]);
    expect(merged.warnings).toMatchObject([{ path: "rows.ne.values.w", severity: "warning" }]);
  });

  test("validation checks accepted rows only, and needs one", () => {
    const { draft } = normalizeFor("standings", {
      rows: [
        { team: "NE", w: 4, l: 1, seed: 9, ...sure },
        { team: "BUF", w: 3, ...sure },
      ],
    }) as { draft: RowTargetDraft };
    expect(validateDraft(draft).map((w) => w.message)).toEqual([
      "BUF: losses is missing",
      "Seeds run from 1 to 7",
    ]);
    const none = { ...draft, rows: draft.rows.map((r) => ({ ...r, accepted: false })) };
    expect(validateDraft(none).map((w) => w.message)).toEqual(["Accept at least one row to commit"]);
  });

  test("accepting a row is not a correction", () => {
    const { draft } = normalizeFor("standings", { rows: [{ team: "NE", w: 4, l: 1, confidence: 0.5 }] }) as {
      draft: RowTargetDraft;
    };
    const edited = {
      ...draft,
      rows: draft.rows.map((r) => ({ ...r, accepted: true, values: { ...r.values, w: 5 } })),
    };
    expect(diffDrafts(draft, edited)).toEqual([{ path: "rows.ne.values.w", from: 4, to: 5 }]);
  });
});

describe("reconciliation", () => {
  test("differences from the logs, open ones first, biggest first", () => {
    const { differences, matched } = reconcile(
      [
        { playerId: "maye", gamesPlayed: 6, stats: { passYds: 1450, passTd: 11 } },
        { playerId: "diggs", gamesPlayed: 6, stats: { recYds: 531 }, resolved: { gamesPlayed: "missing" } },
      ],
      [
        { playerId: "maye", gamesPlayed: 5, totals: { passYds: 1403, passTd: 11 } },
        { playerId: "diggs", gamesPlayed: 5, totals: { recYds: 531 } },
      ],
    );
    expect(matched).toBe(2);
    expect(differences.map((d) => [d.playerId, d.stat, d.delta, d.resolution])).toEqual([
      ["maye", "passYds", 47, null],
      ["maye", "gamesPlayed", 1, null],
      ["diggs", "gamesPlayed", 1, "missing"],
    ]);
  });

  test("weeks played without a box score", () => {
    expect(
      weeksWithoutBoxScore([
        { weekKey: "pre1", status: "played", hasBoxScore: false },
        { weekKey: "w1", status: "played", hasBoxScore: true },
        { weekKey: "w4", status: "bye", hasBoxScore: false },
        { weekKey: "w7", status: "played", hasBoxScore: false },
      ]),
    ).toEqual(["w7"]);
  });
});

describe("usage", () => {
  test("totals per model, most used first", () => {
    expect(
      usageByModel([
        { model: "a", tokens: 100, costUsd: 0.01, latencyMs: 2000 },
        { model: "b", tokens: 50 },
        { model: "a", tokens: 300, latencyMs: 4000 },
      ]),
    ).toEqual([
      { model: "a", extractions: 2, tokens: 400, costUsd: 0.01, avgLatencyMs: 3000 },
      { model: "b", extractions: 1, tokens: 50, costUsd: null, avgLatencyMs: null },
    ]);
  });
});

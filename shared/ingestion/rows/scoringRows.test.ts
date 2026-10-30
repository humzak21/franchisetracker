import { describe, expect, test } from "vitest";
import { onlyScorer, passerCandidates, resolvePasser, scorerCandidates } from "../../games/scorers";
import { mergeRowDrafts, normalizeRows, rowsSchema, validateRows } from "./engine";
import { compareRows, parsePlay, parsePlayClock, rowScorerMatch, scoringPlaysSpec } from "./scoringSpec";
import type { DraftRow, RowGameContext, RowsDraft } from "./types";

const spec = scoringPlaysSpec;

const row = (id: string, values: DraftRow["values"], over: Partial<DraftRow> = {}): DraftRow => ({
  id,
  accepted: true,
  name: "K. Boutte",
  teamAbbr: "NE",
  playerId: "boutte",
  match: { status: "matched", candidates: [] },
  values: { quarter: "1", clock: "10:00", kind: "pass_td", pat: "kick", ...values },
  ...over,
});

const draft = (rows: DraftRow[]): RowsDraft => ({ target: "scoring_plays", meta: {}, rows });

const GAME: RowGameContext = {
  homeAbbr: "NE",
  awayAbbr: "BUF",
  homeScore: 14,
  awayScore: 3,
  lines: [
    { playerId: "maye", name: "Drake Maye", teamAbbr: "NE", stats: { passAtt: 30, passTd: 2 } },
    { playerId: "boutte", name: "Kayshon Boutte", teamAbbr: "NE", stats: { recTd: 1 } },
    { playerId: "diggs", name: "Stefon Diggs", teamAbbr: "NE", stats: { recTd: 1 } },
    { playerId: "bass", name: "Tyler Bass", teamAbbr: "BUF", stats: { fgm: 1 } },
  ],
};

const THREE = [
  row("a", { homeScore: 7, awayScore: 0 }),
  row(
    "b",
    { clock: "2:00", kind: "fg", pat: null, homeScore: 7, awayScore: 3 },
    { teamAbbr: "BUF", name: "T. Bass", playerId: "bass" },
  ),
  row("c", { quarter: "2", homeScore: 14, awayScore: 3 }, { name: "S. Diggs", playerId: "diggs" }),
];

const errors = (d: RowsDraft, game?: RowGameContext | null) =>
  validateRows(spec, d, game).filter((w) => w.severity === "error");

describe("reading the screen", () => {
  test("the model may leave the name null, and the row stays", () => {
    const { draft: read } = normalizeRows("scoring_plays", spec, {
      rows: [
        {
          name: null,
          team: "NE",
          quarter: "1",
          clock: "10:00",
          kind: "pass_td",
          passer: "D. Maye",
          pat: "kick",
          home_score: 7,
          away_score: 0,
          confidence: 0.95,
          unclear_fields: [],
        },
      ],
    });
    expect(read.rows).toHaveLength(1);
    expect(read.rows[0]).toMatchObject({ name: null, accepted: true, teamAbbr: "NE" });
  });

  test("the schema allows a null name", () => {
    const items = rowsSchema(spec).properties?.rows?.items;
    expect(items?.properties?.name?.type).toEqual(["string", "null"]);
  });

  test("two screens of one game merge by quarter, clock and team, in game order", () => {
    const part = (rows: object[]) =>
      normalizeRows("scoring_plays", spec, {
        rows: rows.map((r) => ({ confidence: 0.95, unclear_fields: [], team: "NE", name: "A. B", ...r })),
      });
    const first = { quarter: "2", clock: "3:00", kind: "fg", home_score: 3, away_score: 0 };
    const second = { quarter: "4", clock: "1:00", kind: "fg", home_score: 6, away_score: 0 };
    const merged = mergeRowDrafts(spec, [part([second, first]), part([first])]);
    expect(merged.draft.rows.map((r) => r.values.quarter)).toEqual(["2", "4"]);
    expect(merged.warnings).toEqual([]);
  });

  test("rows with no clock are not merged into one", () => {
    const { draft: read } = normalizeRows("scoring_plays", spec, {
      rows: [
        { quarter: "1", team: "NE", kind: "fg", home_score: 3, away_score: 0, confidence: 1 },
        { quarter: "1", team: "NE", kind: "fg", home_score: 6, away_score: 0, confidence: 1 },
      ],
    });
    expect(read.rows).toHaveLength(2);
  });
});

describe("the clock", () => {
  test("reads as printed and refuses what is not a clock", () => {
    expect(parsePlayClock("12:05")).toBe(725);
    expect(parsePlayClock(":42")).toBe(42);
    expect(parsePlayClock("15:00")).toBe(900);
    expect(parsePlayClock("16:00")).toBeNull();
    expect(parsePlayClock("905")).toBeNull();
    expect(parsePlayClock("9:75")).toBeNull();
  });

  test("rows sort by period, then the clock running down", () => {
    const rows = [
      row("late", { quarter: "2", clock: "1:00" }),
      row("early", { quarter: "2", clock: "9:00" }),
      row("ot", { quarter: "OT", clock: "9:59" }),
    ];
    expect([...rows].sort(compareRows).map((r) => r.id)).toEqual(["early", "late", "ot"]);
  });

  test("a row reads into a play, or nothing while it is incomplete", () => {
    expect(parsePlay(row("a", { homeScore: 7, awayScore: 0 }))).toMatchObject({ period: 1, clock: 600 });
    expect(parsePlay(row("a", { homeScore: 7 }))).toBeNull();
  });
});

describe("checks without the game", () => {
  test("a clean game passes", () => {
    expect(errors(draft(THREE))).toEqual([]);
  });

  test("a score that jumps by two plays is an error on that row", () => {
    const jump = errors(draft([row("a", { homeScore: 14, awayScore: 3 })]));
    expect(jump[0]?.message).toContain("A play is missing");
    expect(jump[0]?.path).toBe("rows.a.values.homeScore");
  });

  test("a field goal worth seven is an error", () => {
    const wrong = errors(draft([row("a", { kind: "fg", pat: null, homeScore: 7, awayScore: 0 })]));
    expect(wrong[0]?.message).toContain("cannot be worth 7");
  });

  test("a touchdown with no try read is checked against what one can be worth", () => {
    expect(errors(draft([row("a", { pat: null, homeScore: 7, awayScore: 0 })]))).toEqual([]);
    expect(errors(draft([row("a", { pat: null, homeScore: 5, awayScore: 0 })]))).toHaveLength(1);
  });

  test("the try is held to its points", () => {
    expect(errors(draft([row("a", { pat: "two", homeScore: 8, awayScore: 0 })]))).toEqual([]);
    expect(errors(draft([row("a", { pat: "two_failed", homeScore: 7, awayScore: 0 })]))).toHaveLength(1);
  });

  test("a row left out of the commit is not checked, and what is left must still add up", () => {
    const skipped = THREE.map((r) => (r.id === "b" ? { ...r, accepted: false } : r));
    expect(errors(draft(skipped))[0]?.message).toContain("A play is missing");
  });

  test("a row with no name warns but never blocks", () => {
    const nameless = row(
      "a",
      { homeScore: 7, awayScore: 0 },
      { name: null, playerId: null, match: { status: "new", candidates: [] } },
    );
    const warnings = validateRows(spec, draft([nameless]));
    expect(warnings.filter((w) => w.severity === "error")).toEqual([]);
    expect(warnings).toContainEqual(
      expect.objectContaining({
        path: "rows.a.name",
        severity: "warning",
        message: expect.stringContaining("needs a player"),
      }),
    );
  });

  test("a printed name with no player stays as printed, never a new player", () => {
    const unmatched = row(
      "a",
      { homeScore: 7, awayScore: 0 },
      { playerId: null, match: { status: "new", candidates: [] } },
    );
    expect(
      validateRows(spec, draft([unmatched]))
        .map((w) => w.message)
        .join(),
    ).not.toContain("new player");
  });

  test("a safety needs no player", () => {
    const safety = row(
      "a",
      { kind: "safety", pat: null, homeScore: 2, awayScore: 0 },
      { name: null, playerId: null },
    );
    expect(validateRows(spec, draft([safety]))).toEqual([]);
  });
});

describe("checks against the game", () => {
  test("a clean game passes with its final and box score", () => {
    expect(validateRows(spec, draft(THREE), GAME).filter((w) => w.severity !== "info")).toEqual([]);
  });

  test("no game to file under blocks the commit", () => {
    expect(errors(draft(THREE), null)[0]?.message).toContain("no game");
  });

  test("plays that stop short of the final block the commit", () => {
    expect(errors(draft(THREE.slice(0, 2)), GAME).at(-1)?.message).toContain("the game's final is");
  });

  test("the team has to be one of the game's two, and the one whose score went up", () => {
    const stranger = THREE.map((r) => (r.id === "a" ? { ...r, teamAbbr: "KC" } : r));
    expect(
      errors(draft(stranger), GAME)
        .map((w) => w.message)
        .join(),
    ).toContain("KC did not play");
    const swapped = THREE.map((r) => (r.id === "a" ? { ...r, teamAbbr: "BUF" } : r));
    expect(errors(draft(swapped), GAME)[0]).toMatchObject({ path: "rows.a.teamAbbr" });
  });

  test("the box score disagreeing is a warning naming the count", () => {
    const short = { ...GAME, lines: GAME.lines.filter((l) => l.playerId !== "diggs") };
    const warnings = validateRows(spec, draft(THREE), short);
    expect(warnings.filter((w) => w.severity === "error")).toEqual([]);
    expect(warnings.map((w) => w.message)).toContain(
      "NE: 2 receiving touchdowns in these plays, 1 in the box score",
    );
  });

  test("the player is named when that player's own count is off", () => {
    const twice = THREE.map((r) => (r.id === "c" ? { ...r, playerId: "boutte" } : r));
    expect(validateRows(spec, draft(twice), GAME).map((w) => w.message)).toContain(
      "Kayshon Boutte: 2 receiving touchdowns in these plays, 1 in the box score",
    );
  });
});

describe("who a nameless play can be", () => {
  const lines = GAME.lines;

  test("ranks the kind's stat and counts out those on another play", () => {
    const ranked = scorerCandidates("pass_td", "NE", lines, [{ kind: "pass_td", playerId: "diggs" }]);
    expect(ranked.map((r) => [r.playerId, r.open])).toEqual([
      ["boutte", 1],
      ["diggs", 0],
    ]);
    expect(onlyScorer(ranked)?.playerId).toBe("boutte");
  });

  test("there is no one answer while two players are open", () => {
    expect(onlyScorer(scorerCandidates("pass_td", "NE", lines, []))).toBeNull();
  });

  test("a kind with no stat, or a team with no line, offers nobody", () => {
    expect(scorerCandidates("safety", "NE", lines, [])).toEqual([]);
    expect(scorerCandidates("pass_td", "BUF", lines, [])).toEqual([]);
  });

  test("the row's match opens on the box score and leaves a chosen row alone", () => {
    const nameless = row("n", { homeScore: 7, awayScore: 0 }, { name: null, playerId: null });
    const other = row("o", { quarter: "2", homeScore: 14, awayScore: 3 }, { playerId: "diggs" });
    const match = rowScorerMatch(nameless, [nameless, other], GAME);
    expect(match?.status).toBe("ambiguous");
    expect(match?.candidates[0]?.playerId).toBe("boutte");
    expect(rowScorerMatch(other, [nameless, other], GAME)).toBeNull();
  });

  test("the passer is the printed name, else the team's only touchdown passer", () => {
    expect(passerCandidates("NE", lines).map((p) => p.playerId)).toEqual(["maye"]);
    expect(resolvePasser("D. Maye", "NE", lines)).toBe("maye");
    expect(resolvePasser(null, "NE", lines)).toBe("maye");
    expect(resolvePasser("J. Backup", "NE", lines)).toBeNull();
    expect(resolvePasser(null, "BUF", lines)).toBeNull();
  });
});

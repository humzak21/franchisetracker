import { describe, expect, test } from "vitest";
import type { StatLine } from "../../stats/registry";
import type { GameLogDraft } from "../types";
import { gameLogContext, gameLogPlayWarnings } from "./gameLogPlays";
import { NEW_LINE, rowScorerMatch } from "./scoringSpec";
import type { DraftRow, RowGameContext } from "./types";

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

const GAME: RowGameContext = {
  homeAbbr: "NE",
  awayAbbr: "BUF",
  homeScore: 14,
  awayScore: 3,
  lines: [{ playerId: "boutte", name: "Kayshon Boutte", teamAbbr: "NE", stats: { recTd: 1 } }],
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

describe("a full game log's plays", () => {
  const log = (plays: DraftRow[] | undefined, lines: GameLogDraft["lines"] = []): GameLogDraft => ({
    target: "game_log",
    game: {
      homeAbbr: "NE",
      awayAbbr: "BUF",
      homeScore: 14,
      awayScore: 3,
      overtime: false,
      lineScore: null,
    },
    lines,
    teams: [],
    plays,
  });
  const line = (id: string, playerId: string | null, stats: StatLine): GameLogDraft["lines"][number] => ({
    id,
    teamAbbr: "NE",
    name: id,
    position: null,
    stats,
    playerId,
    match: { status: "new", candidates: [] },
  });
  const paths = (w: { path?: string }[]) => w.flatMap((x) => (x.path ? [x.path] : []));

  test("a log with no plays, or with every play left out, checks nothing", () => {
    expect(gameLogPlayWarnings(log(undefined), GAME)).toEqual([]);
    expect(gameLogPlayWarnings(log([]), GAME)).toEqual([]);
    const skipped = THREE.map((r) => ({ ...r, accepted: false }));
    expect(gameLogPlayWarnings(log(skipped), GAME)).toEqual([]);
  });

  test("plays are held to the log's own final, with paths on the plays", () => {
    const short = gameLogPlayWarnings(log(THREE.slice(0, 2)), null);
    expect(short.map((w) => w.message).join()).toContain("the game's final is 3-14");
    const wrong = gameLogPlayWarnings(
      log([row("a", { kind: "fg", pat: null, homeScore: 7, awayScore: 0 })]),
      null,
    );
    expect(paths(wrong)).toContain("plays.a.values.kind");
    expect(paths(wrong).some((p) => p.startsWith("rows."))).toBe(false);
  });

  test("the log's own box score is used, else the game's stored one", () => {
    const own = gameLogContext(log(THREE, [line("a", "boutte", { recTd: 2 })]), GAME);
    expect(own?.lines.map((l) => l.playerId)).toEqual(["boutte"]);
    expect(gameLogContext(log(THREE), GAME)?.lines).toHaveLength(GAME.lines.length);
    expect(gameLogContext(log(THREE), null)?.lines).toEqual([]);
  });

  test("a line new in this review counts toward the box score but cannot be picked", () => {
    const context = gameLogContext(log(THREE, [line("new", null, { recTd: 1 })]), null)!;
    expect(context.lines[0]?.playerId).toBe(`${NEW_LINE}new`);
    const nameless = row("n", { homeScore: 7, awayScore: 0 }, { name: null, playerId: null });
    expect(rowScorerMatch(nameless, [nameless], context)).toBeNull();
  });

  test("no teams on the header means nothing to check against", () => {
    const draft = log(THREE);
    expect(gameLogContext({ ...draft, game: { ...draft.game, homeAbbr: null } }, GAME)).toBeNull();
  });
});

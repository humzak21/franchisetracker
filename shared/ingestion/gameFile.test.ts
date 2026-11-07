import { describe, expect, test } from "vitest";
import { clockText, gameFileDraft, gameFileFromText, gameFileLabel } from "./gameFile";
import { validateDraft } from "./targets";

/** A trimmed game as `npm run export:madden` writes it (`games/<year>/<week>-<away>-at-<home>.json`). */
const FILE = {
  year: 2026,
  week: "w3",
  awayAbbr: "BUF",
  homeAbbr: "NE",
  played: true,
  awayScore: 7,
  homeScore: 10,
  overtime: false,
  simmed: false,
  lineScore: { home: [0, 7, 3, 0], away: [7, 0, 0, 0] },
  weather: { condition: "Clear", temperatureF: 61, wind: "Calm" },
  lines: [
    {
      teamAbbr: "NE",
      name: "Drake Maye",
      position: "QB",
      started: true,
      stats: { passCmp: 20, passAtt: 30, passYds: 250, passTd: 1, made_up: 4 },
    },
    { teamAbbr: "NE", name: "Andres Borregales", position: "K", started: true, stats: { fgm: 1, fga: 1 } },
    { teamAbbr: "BUF", name: "James Cook", position: "HB", started: true, stats: { rushAtt: 15, rushTd: 1 } },
    { teamAbbr: "DAL", name: "Somebody Else", position: "WR", started: false, stats: { rec: 1 } },
  ],
  teams: [
    { teamAbbr: "BUF", stats: { passYds: 150, rushYds: 90, totalYds: 1, plays: 50 } },
    { teamAbbr: "NE", stats: { passYds: 250, rushYds: 80, plays: 60, bogus: 3 } },
  ],
  plays: [
    {
      order: 1,
      period: 1,
      clock: 571,
      teamAbbr: "BUF",
      kind: "other",
      pat: "kick",
      homeScore: 0,
      awayScore: 7,
      description: "Touchdown, kick good (play not in the save)",
    },
    {
      order: 2,
      period: 2,
      clock: 3,
      teamAbbr: "NE",
      kind: "other",
      pat: "kick",
      homeScore: 7,
      awayScore: 7,
      description: "Touchdown",
    },
    {
      order: 3,
      period: 3,
      clock: 65,
      teamAbbr: "NE",
      kind: "fg",
      pat: null,
      homeScore: 10,
      awayScore: 7,
      description: "Field goal",
    },
  ],
};

const read = (file: unknown) => {
  const result = gameFileDraft(file);
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe("game files", () => {
  test("the file's season and week say where the draft is filed", () => {
    const { year, weekKey, draft } = read(FILE);
    expect({ year, weekKey }).toEqual({ year: 2026, weekKey: "w3" });
    expect(draft.game).toEqual({
      homeAbbr: "NE",
      awayAbbr: "BUF",
      homeScore: 10,
      awayScore: 7,
      overtime: false,
      lineScore: { home: [0, 7, 3, 0], away: [7, 0, 0, 0] },
    });
  });

  test("player lines keep registry stats only and wait for the rosters to resolve the names", () => {
    const { draft } = read(FILE);
    expect(draft.lines.map((l) => l.id)).toEqual(["ne-drake-maye", "ne-andres-borregales", "buf-james-cook"]);
    expect(draft.lines[0]).toEqual({
      id: "ne-drake-maye",
      teamAbbr: "NE",
      name: "Drake Maye",
      position: "QB",
      stats: { passCmp: 20, passAtt: 30, passYds: 250, passTd: 1 },
      playerId: null,
      match: { status: "new", candidates: [] },
    });
  });

  test("team stats keep the team registry's keys, with total yards worked out again", () => {
    const { draft } = read(FILE);
    expect(draft.teams).toEqual([
      { teamAbbr: "BUF", stats: { passYds: 150, rushYds: 90, totalYds: 240, plays: 50 } },
      { teamAbbr: "NE", stats: { passYds: 250, rushYds: 80, totalYds: 330, plays: 60 } },
    ]);
  });

  test("scoring plays become accepted review rows with no scorer", () => {
    const { draft } = read(FILE);
    expect(draft.plays?.[0]).toEqual({
      id: "play-1",
      accepted: true,
      name: null,
      teamAbbr: "BUF",
      values: {
        quarter: "1",
        clock: "9:31",
        kind: "other",
        yards: null,
        passer: null,
        pat: "kick",
        awayScore: 7,
        homeScore: 0,
        description: "Touchdown, kick good (play not in the save)",
      },
      playerId: null,
      match: { status: "new", candidates: [] },
    });
    expect(draft.plays?.map((p) => p.values.kind)).toEqual(["other", "other", "fg"]);
  });

  test("a consistent file passes the game log's own checks, short of who the names are", () => {
    const errors = validateDraft(read(FILE).draft).filter((w) => w.severity === "error");
    expect(errors.every((w) => w.path?.endsWith(".name"))).toBe(true);
    expect(errors).toHaveLength(3);
  });

  test("files that are not a played game of two NFL teams are refused", () => {
    expect(gameFileDraft([])).toEqual({ ok: false, error: "This is not a game file" });
    expect(gameFileDraft({ ...FILE, week: undefined }).ok).toBe(false);
    expect(gameFileDraft({ ...FILE, week: "w42" })).toEqual({ ok: false, error: '"w42" is not a week' });
    expect(gameFileDraft({ ...FILE, homeAbbr: "XYZ" }).ok).toBe(false);
    expect(gameFileDraft({ ...FILE, played: false })).toEqual({
      ok: false,
      error: "This game has not been played",
    });
    expect(gameFileFromText("{not json")).toEqual({ ok: false, error: "This file is not JSON" });
    expect(gameFileFromText(JSON.stringify(FILE)).ok).toBe(true);
  });

  test("clocks print as review shows them", () => {
    expect([clockText(0), clockText(65), clockText(900)]).toEqual(["0:00", "1:05", "15:00"]);
  });
});

test("an imported file is named by its season, week and teams", () => {
  expect(gameFileLabel(read(FILE))).toBe("2026 Week 3 · BUF at NE");
});

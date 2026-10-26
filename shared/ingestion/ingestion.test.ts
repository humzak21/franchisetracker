import { describe, expect, test } from "vitest";
import { resolveTeamAbbr } from "../domain/teams";
import { diffDrafts } from "./diff";
import { matchPlayer, nameScore, nameTokens, type NameCandidate } from "./nameMatch";
import { normalizeBoxScore, normalizeTeamStats } from "./normalize";
import { boxScoreSchema, teamStatsSchema, type JsonSchema } from "./schema";
import { buildPrompt } from "./prompt";
import { INGESTION_TARGETS, TARGET_KEYS, normalizeFor, schemaFor, validateDraft } from "./targets";
import { blocksCommit, validateBoxScore } from "./validate";

const row = (extra: Record<string, unknown>) => ({
  confidence: 0.9,
  unclear_fields: [],
  position: null,
  ...extra,
});

const RAW_BOX = {
  home_team: "Patriots",
  away_team: "LV",
  home_score: 31,
  away_score: 17,
  overtime: false,
  home_quarters: [7, 14, 3, 7],
  away_quarters: [3, 7, 0, 7],
  passing: [
    row({ team: "NE", name: "D. Maye", pass_cmp: 22, pass_att: 30, pass_yds: 284, pass_td: 3, pass_int: 0 }),
  ],
  rushing: [
    row({ team: "NE", name: "D. Maye", rush_att: 4, rush_yds: 21, rush_td: 0 }),
    row({
      team: "NE",
      name: "T. Henderson",
      rush_att: 18,
      rush_yds: 102,
      rush_td: 1,
      unclear_fields: ["rush_yds"],
    }),
  ],
  receiving: [
    row({ team: "NE", name: "S. Diggs", rec: 8, rec_yds: 131, rec_td: 2 }),
    row({ team: "NE", name: "H. Henry", rec: 14, rec_yds: 153, rec_td: 1 }),
  ],
  defense: [],
  kicking: [row({ team: "NE", name: "A. Borregales", fgm: 1, fga: 1, xpm: 4, xpa: 4 })],
  punting: [],
  returns: [],
};

describe("team text resolution", () => {
  test("abbreviations, names, aliases and unique cities", () => {
    expect(resolveTeamAbbr("ne")).toBe("NE");
    expect(resolveTeamAbbr("Patriots")).toBe("NE");
    expect(resolveTeamAbbr("New England Patriots")).toBe("NE");
    expect(resolveTeamAbbr("OAK")).toBe("LV");
    expect(resolveTeamAbbr("Green Bay")).toBe("GB");
    expect(resolveTeamAbbr("New York")).toBeNull();
    expect(resolveTeamAbbr("Raider Nation")).toBeNull();
  });
});

describe("schemas", () => {
  const strict = (schema: JsonSchema): void => {
    if (schema.properties) {
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required?.sort()).toEqual(Object.keys(schema.properties).sort());
      Object.values(schema.properties).forEach(strict);
    }
    if (schema.items) strict(schema.items);
  };
  test("are strict-mode objects generated from the registries", () => {
    strict(boxScoreSchema());
    strict(teamStatsSchema());
    const passing = boxScoreSchema().properties?.passing?.items?.properties ?? {};
    expect(Object.keys(passing)).toEqual(
      expect.arrayContaining(["name", "pass_cmp", "pass_yds", "confidence"]),
    );
    expect(Object.keys(teamStatsSchema().properties?.teams?.items?.properties ?? {})).toContain(
      "time_of_possession",
    );
  });
  test("every target declares a schema, normalizer and validator", () => {
    for (const key of TARGET_KEYS) {
      expect(schemaFor(key).type).toBe("object");
      expect(normalizeFor(key, {}).draft.target).toBe(key);
      expect(INGESTION_TARGETS[key].scope).toMatch(/game|week|season/);
    }
  });
});

describe("name matching", () => {
  const players: NameCandidate[] = [
    {
      playerId: "maye",
      displayName: "Drake Maye",
      firstName: "Drake",
      lastName: "Maye",
      aliases: [],
      teamAbbr: "NE",
    },
    {
      playerId: "diggs",
      displayName: "Stefon Diggs",
      firstName: "Stefon",
      lastName: "Diggs",
      aliases: [],
      teamAbbr: "NE",
    },
    { playerId: "moore", displayName: "D.J. Moore Jr.", firstName: "D.J.", lastName: "Moore", aliases: [] },
    { playerId: "dmoore", displayName: "David Moore", firstName: "David", lastName: "Moore", aliases: [] },
    {
      playerId: "jj",
      displayName: "Jaxon Smith-Njigba",
      firstName: "Jaxon",
      lastName: "Smith-Njigba",
      aliases: ["JSN"],
    },
  ];

  test("tokens drop punctuation and suffixes", () => {
    expect(nameTokens("D.J. Moore Jr.")).toEqual(["dj", "moore"]);
    expect(nameTokens("Smith-Njigba")).toEqual(["smithnjigba"]);
  });

  test("initials, full names and one-letter typos match", () => {
    const maye = matchPlayer("D. Maye", players);
    expect(maye.status).toBe("matched");
    expect(maye.candidates[0]?.playerId).toBe("maye");
    expect(matchPlayer("Drake Maye", players).candidates[0]).toMatchObject({ playerId: "maye", score: 1 });
    expect(matchPlayer("Stefon Digs", players).candidates[0]?.playerId).toBe("diggs");
    expect(matchPlayer("J. Smith-Njigba", players).candidates[0]?.playerId).toBe("jj");
    expect(matchPlayer("JSN", players).candidates[0]?.playerId).toBe("jj");
  });

  test("a shared initial and surname is ambiguous, a stranger is new", () => {
    expect(matchPlayer("D. Moore", players).status).toBe("ambiguous");
    expect(matchPlayer("Rhamondre Stevenson", players).status).toBe("new");
  });

  test("a last name alone scores below a full match", () => {
    expect(nameScore("Maye", { first: "Drake", last: "Maye", full: "Drake Maye" })).toBeLessThan(0.9);
  });
});

describe("normalizeBoxScore", () => {
  test("merges a player's category rows and resolves teams", () => {
    const { draft, confidence, warnings } = normalizeBoxScore(RAW_BOX);
    expect(draft.game).toMatchObject({ homeAbbr: "NE", awayAbbr: "LV", homeScore: 31, overtime: false });
    const maye = draft.lines.find((l) => l.name === "D. Maye");
    expect(maye?.stats).toMatchObject({ passYds: 284, rushYds: 21, rushAtt: 4 });
    expect(draft.lines).toHaveLength(5);
    expect(warnings).toEqual([]);
    const henderson = draft.lines.find((l) => l.name === "T. Henderson")!;
    expect(confidence.find((c) => c.path === `lines.${henderson.id}.stats.rushYds`)?.value).toBeLessThan(0.5);
  });

  test("survives garbage and flags unknown teams", () => {
    expect(normalizeBoxScore(null).draft.lines).toEqual([]);
    const { warnings } = normalizeBoxScore({ home_team: "Moon Men", passing: [{ name: 4 }] });
    expect(warnings[0]).toMatchObject({ path: "game.homeAbbr", severity: "error" });
  });

  test("two screenshots disagreeing on a stat is a warning", () => {
    const raw = {
      ...RAW_BOX,
      rushing: [...RAW_BOX.rushing, row({ team: "NE", name: "D Maye", rush_yds: 25 })],
    };
    expect(normalizeBoxScore(raw).warnings[0]?.message).toMatch(/disagree/);
  });

  test("overtime is inferred from a fifth period", () => {
    const raw = {
      ...RAW_BOX,
      overtime: null,
      home_quarters: [7, 7, 7, 3, 6],
      away_quarters: [7, 7, 7, 3, 0],
    };
    expect(normalizeBoxScore(raw).draft.game.overtime).toBe(true);
  });
});

describe("validation", () => {
  const draft = () => normalizeBoxScore(RAW_BOX).draft;

  test("a clean draft only notes new players", () => {
    const warnings = validateBoxScore(draft());
    expect(warnings.every((w) => w.severity === "info")).toBe(true);
    expect(blocksCommit(warnings)).toBe(false);
  });

  test("completions over attempts and a wrong team block commit", () => {
    const d = draft();
    d.lines[0]!.stats.passCmp = 40;
    d.lines[1]!.teamAbbr = "KC";
    const warnings = validateDraft(d);
    expect(warnings.filter((w) => w.severity === "error").map((w) => w.path)).toEqual([
      `lines.${d.lines[0]!.id}.stats.passCmp`,
      `lines.${d.lines[1]!.id}.teamAbbr`,
    ]);
  });

  test("quarters that do not add up and points beyond the score are warnings", () => {
    const d = draft();
    d.game.homeScore = 10;
    const messages = validateBoxScore(d).map((w) => w.message);
    expect(messages).toEqual(expect.arrayContaining([expect.stringMatching(/quarters add up to 31/)]));
    expect(messages).toEqual(expect.arrayContaining([expect.stringMatching(/more than 10/)]));
  });

  test("team stats check made against attempted and yard totals", () => {
    const { draft: d } = normalizeTeamStats({
      home_team: "NE",
      away_team: "LV",
      teams: [
        {
          team: "NE",
          third_down_conv: 9,
          third_down_att: 5,
          pass_yds: 250,
          rush_yds: 100,
          total_yds: 360,
          time_of_possession: "31:42",
        },
      ],
    });
    expect(d.teams[0]?.stats.possessionSec).toBe(31 * 60 + 42);
    expect(validateDraft(d).map((w) => w.path)).toEqual([
      "teams.0.stats.thirdDownConv",
      "teams.0.stats.totalYds",
    ]);
  });
});

describe("corrections and prompts", () => {
  test("diff reports edited scalars by line id", () => {
    const before = normalizeBoxScore(RAW_BOX).draft;
    const after = structuredClone(before);
    after.lines[0]!.stats.passYds = 248;
    after.lines[0]!.playerId = "maye";
    after.lines = after.lines.filter((l) => l.name !== "H. Henry");
    const henry = before.lines.find((l) => l.name === "H. Henry")!;
    const changes = diffDrafts(before, after);
    expect(changes).toContainEqual({
      path: `lines.${before.lines[0]!.id}.stats.passYds`,
      from: 284,
      to: 248,
    });
    expect(changes).toContainEqual({ path: `lines.${henry.id}.name`, from: "H. Henry", to: null });
    expect(changes.some((c) => c.path.endsWith("playerId"))).toBe(false);
  });

  test("prompts carry context and past corrections", () => {
    const { user } = buildPrompt(
      "game_box_score",
      { userTeam: "NE (New England Patriots)", when: "2026 season, Week 1" },
      [{ fieldPath: "lines.ne-d-maye.stats.passYds", extracted: 284, corrected: 248 }],
    );
    expect(user).toMatch(/NE \(New England Patriots\)/);
    expect(user).toMatch(/read as 284, actually 248/);
  });
});

/** Integrity of the registries everything else is keyed by, and the small helpers around them. */
import { describe, expect, test } from "vitest";
import { pickLabel, teamLeaders, transactionLabel } from "../seasons/summary";
import { STAT_GROUPS, statGroup } from "./groups";
import { STAT_REGISTRY, isStatKey } from "./registry";
import {
  TEAM_STAT_KEYS,
  TEAM_STAT_ROWS,
  TEAM_STATS,
  formatTeamRow,
  formatTeamStat,
  isTeamStatKey,
  parseClock,
  rowValue,
} from "./teamRegistry";
import { TEAM_SEASON_STAT_KEYS, TEAM_SEASON_STATS, formatTeamSeasonStat } from "./teamSeasonRegistry";

describe("stat groups", () => {
  test("every group's phone columns and lead stat are registry stats in its categories", () => {
    for (const group of STAT_GROUPS) {
      for (const key of [...group.phone, group.lead]) {
        expect(isStatKey(key), `${group.id}: ${key}`).toBe(true);
        expect(group.categories, `${group.id}: ${key}`).toContain(STAT_REGISTRY[key].category);
      }
    }
    expect(new Set(STAT_GROUPS.map((g) => g.id)).size).toBe(STAT_GROUPS.length);
  });

  test("an unknown group falls back to the first", () => {
    expect(statGroup(STAT_GROUPS[1]!.id)).toBe(STAT_GROUPS[1]);
    expect(statGroup("nonsense")).toBe(STAT_GROUPS[0]);
  });
});

describe("team stat registry", () => {
  test("every comparison row reads registry keys, and every key is labelled", () => {
    for (const row of TEAM_STAT_ROWS) for (const key of row.keys) expect(isTeamStatKey(key), key).toBe(true);
    for (const key of TEAM_STAT_KEYS) expect(TEAM_STATS[key].label.length).toBeGreaterThan(0);
    expect(isTeamStatKey("nonsense")).toBe(false);
  });

  test("formats single values, pairs, penalties and time of possession", () => {
    const row = (id: string) => TEAM_STAT_ROWS.find((r) => r.id === id)!;
    const line = {
      thirdDownConv: 5,
      thirdDownAtt: 12,
      penalties: 6,
      penaltyYds: 45,
      possessionSec: 1902,
      totalYds: 1234,
    };
    expect(formatTeamRow(row("thirdDown"), line)).toBe("5/12");
    expect(formatTeamRow(row("penalties"), line)).toBe("6-45");
    expect(formatTeamRow(row("totalYds"), line)).toBe("1,234");
    expect(formatTeamStat("possessionSec", 1902)).toBe("31:42");
    expect(formatTeamStat("totalYds", undefined)).toBe("—");
    expect(rowValue(row("thirdDown"), line)).toBe(5);
    expect(rowValue(row("plays"), line)).toBeNull();
  });

  test("reads a possession clock or a number of seconds", () => {
    expect(parseClock("31:42")).toBe(1902);
    expect(parseClock(" 1902 ")).toBe(1902);
    expect(parseClock("half")).toBeNull();
  });

  test("team season stats are labelled and formatted to their decimals", () => {
    for (const key of TEAM_SEASON_STAT_KEYS) expect(TEAM_SEASON_STATS[key].label.length).toBeGreaterThan(0);
    expect(formatTeamSeasonStat("pointsPg", 27.34)).toBe("27.3");
    expect(formatTeamSeasonStat("sacks", 41)).toBe("41");
  });
});

describe("season summary", () => {
  test("one leader per summary stat; nobody leads a stat nobody recorded", () => {
    const leaders = teamLeaders([
      { playerId: "maye", totals: { passYds: 3800, rushYds: 420 } },
      { playerId: "henderson", totals: { rushYds: 1100 } },
      { playerId: "spillane", totals: { tackles: 130, sacks: 0 } },
    ]);
    expect(leaders).toEqual([
      { stat: "passYds", playerId: "maye", value: 3800 },
      { stat: "rushYds", playerId: "henderson", value: 1100 },
      { stat: "tackles", playerId: "spillane", value: 130 },
    ]);
  });

  test("labels moves and picks", () => {
    expect(transactionLabel("trade", "w3", ["A", "B"])).toBe("Trade · W3 · A, B");
    expect(transactionLabel("sign", undefined, [])).toMatch(/^Sign\w* · Offseason$/);
    expect(pickLabel(1, 12, "Drake Maye")).toBe("Rd 1, #12 · Drake Maye");
    expect(pickLabel(3, 70, undefined)).toBe("Rd 3, #70");
  });
});

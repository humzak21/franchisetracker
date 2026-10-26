import { describe, expect, it } from "vitest";
import {
  DERIVED_STATS,
  RAW_STATS,
  STAT_REGISTRY,
  aggregateLines,
  eliteTier,
  extractionField,
  formatRank,
  formatRecord,
  formatStat,
  gameHighlights,
  passerRating,
  pace,
  statValue,
  type StatLine,
} from "./index";

describe("passerRating", () => {
  it("matches a known line: Drake Maye 2025 (105.6)", () => {
    expect(passerRating({ cmp: 363, att: 525, yds: 4228, td: 42, int: 18 })).toBe(105.6);
  });
  it("caps at a perfect 158.3", () => {
    expect(passerRating({ cmp: 20, att: 20, yds: 400, td: 5, int: 0 })).toBe(158.3);
  });
  it("returns null with no attempts", () => {
    expect(passerRating({ cmp: 0, att: 0, yds: 0, td: 0, int: 0 })).toBeNull();
  });
});

describe("registry integrity", () => {
  it("has unique keys across raw and derived stats", () => {
    const overlap = Object.keys(RAW_STATS).filter((key) => key in DERIVED_STATS);
    expect(overlap).toEqual([]);
  });
  it("derived stats only depend on raw stats", () => {
    for (const def of Object.values(DERIVED_STATS)) {
      for (const dep of def.dependsOn) expect(dep in RAW_STATS).toBe(true);
    }
  });
  it("every stat has a label and abbreviation", () => {
    for (const def of Object.values(STAT_REGISTRY)) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.abbr.length).toBeGreaterThan(0);
    }
  });
  it("maps keys to snake_case extraction fields", () => {
    expect(extractionField("passYds")).toBe("pass_yds");
    expect(extractionField("fgm50plus")).toBe("fgm_50plus");
    expect(extractionField("fgm0_29")).toBe("fgm_0_29");
  });
});

describe("aggregation", () => {
  const games: StatLine[] = [
    { rec: 8, recYds: 120, recTd: 1, recLong: 45 },
    { rec: 4, recYds: 60, recTd: 2, recLong: 64 },
  ];
  it("sums counting stats and takes the max of longest stats", () => {
    expect(aggregateLines(games)).toEqual({ rec: 12, recYds: 180, recTd: 3, recLong: 64 });
  });
  it("derives averages from totals", () => {
    const totals = aggregateLines(games);
    expect(statValue("recAvg", totals)).toBe(15);
    expect(statValue("recYpg", totals, { games: 2 })).toBe(90);
  });
  it("returns null for raw stats that were never recorded", () => {
    expect(statValue("sacks", {})).toBeNull();
  });
  it("projects pace over a full season", () => {
    expect(pace(500, 5)).toBe(1700);
  });
});

describe("thresholds", () => {
  it("assigns two highlight tiers", () => {
    expect(eliteTier("recYds", 999)).toBe(0);
    expect(eliteTier("recYds", 1000)).toBe(1);
    expect(eliteTier("recYds", 1687)).toBe(2);
  });
  it("respects overrides", () => {
    expect(eliteTier("recYds", 1100, { recYds: { tier1: 1200 } })).toBe(0);
  });
  it("detects threshold games", () => {
    const keys = gameHighlights({ passCmp: 20, passAtt: 26, passYds: 320, passTd: 3, passInt: 0 }).map(
      (t) => t.key,
    );
    expect(keys).toEqual(["pass300", "pass3td"]);
  });
});

describe("formatting", () => {
  it("formats by registry format", () => {
    expect(formatStat("passYds", 4228)).toBe("4,228");
    expect(formatStat("passCmpPct", 69.142)).toBe("69.1%");
    expect(formatStat("sacks", 3.5)).toBe("3.5");
    expect(formatStat("sacks", 7)).toBe("7");
    expect(formatStat("passRating", null)).toBe("—");
  });
  it("formats records and ranks", () => {
    expect(formatRecord({ w: 12, l: 5 })).toBe("12-5");
    expect(formatRecord({ w: 12, l: 4, t: 1 })).toBe("12-4-1");
    expect(formatRank(3, true)).toBe("T-3rd");
    expect(formatRank(11)).toBe("11th");
    expect(formatRank(22)).toBe("22nd");
  });
});

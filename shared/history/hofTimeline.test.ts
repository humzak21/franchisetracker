import { describe, expect, test } from "vitest";
import { cleanStaff, formatSchemes } from "../domain/coaching";
import { careerSpan, headlineStats, retiredNumbers, wallOrder } from "./hof";
import { countByKind, groupByYear, sortTimeline, type TimelineEntry } from "./timeline";

describe("hall of fame", () => {
  test("a plaque leads with the position's own numbers", () => {
    const totals = { rushAtt: 300, rushYds: 1500, rushTd: 12, rec: 40, recYds: 350 };
    expect(headlineStats("HB", totals, 17)).toEqual([
      { stat: "rushYds", value: 1500 },
      { stat: "rushTd", value: 12 },
      { stat: "rushAvg", value: 5 },
    ]);
    expect(headlineStats("WR", totals, 17).map((h) => h.stat)).toEqual(["rec", "recYds", "rushYds"]);
    expect(headlineStats("QB", {}, 0)).toEqual([]);
  });

  test("career span", () => {
    expect(careerSpan(2026, 2034)).toBe("2026–2034");
    expect(careerSpan(2026, 2026)).toBe("2026");
    expect(careerSpan(undefined, undefined)).toBe("");
  });

  test("wall order and retired numbers", () => {
    const entries = [
      { name: "B", inductedYear: 2030, jersey: 12, retiredNumber: true },
      { name: "A", inductedYear: 2030, jersey: 87, retiredNumber: false },
      { name: "C", inductedYear: 2028, jersey: 4, retiredNumber: true },
      { name: "D", inductedYear: 2031, retiredNumber: true },
    ];
    expect(wallOrder(entries).map((e) => e.name)).toEqual(["C", "A", "B", "D"]);
    expect(retiredNumbers(entries).map((e) => e.jersey)).toEqual([4, 12]);
  });
});

describe("coaching", () => {
  test("schemes and cleaning", () => {
    expect(formatSchemes({ offensiveScheme: "Spread", defensiveScheme: "3-4" })).toBe("Spread / 3-4");
    expect(formatSchemes(undefined)).toBe("");
    expect(cleanStaff({ headCoach: "  Mike Vrabel ", offensiveScheme: " " })).toEqual({
      headCoach: "Mike Vrabel",
    });
    expect(cleanStaff({ headCoach: "" })).toBeUndefined();
  });
});

describe("timeline", () => {
  const entry = (
    id: string,
    year: number,
    at: TimelineEntry["at"],
    kind: TimelineEntry["kind"] = "game",
  ) => ({
    id,
    year,
    at,
    kind,
  });

  test("newest season first, then in the order the season happened", () => {
    const sorted = sortTimeline([
      entry("post", 2026, "end", "season"),
      entry("w3", 2026, "w3"),
      entry("pre", 2026, "start", "season"),
      entry("sb", 2026, "sb"),
      entry("next", 2027, "w1"),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["next", "pre", "w3", "sb", "post"]);
    expect(groupByYear(sorted).map((g) => [g.year, g.entries.length])).toEqual([
      [2027, 1],
      [2026, 4],
    ]);
  });

  test("counts per kind", () => {
    expect(countByKind([entry("a", 1, "w1"), entry("b", 1, "w1", "award")])).toMatchObject({
      game: 1,
      award: 1,
      hof: 0,
    });
  });
});

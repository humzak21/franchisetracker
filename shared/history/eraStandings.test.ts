import { describe, expect, test } from "vitest";
import { buildBracket, groupStandings } from "../league/standings";
import { leagueAlignment } from "../league/alignment";
import { deriveStandings } from "./eraStandings";
import { NFLVERSE_ERA_SAMPLE } from "./nflverseEraSample";
import { importYears, playoffsFromGames } from "./nflverse";
import { parseGames } from "./nflverseGames";

const games = parseGames(NFLVERSE_ERA_SAMPLE.games);
const playoffs = playoffsFromGames(games);
const season = (year: number) => deriveStandings(year, games, playoffs.get(year));
const team = (year: number, abbr: string) => season(year).find((s) => s.teamAbbr === abbr);
const seedsOf = (year: number, conference: "AFC" | "NFC") =>
  season(year)
    .filter((s) => s.seed !== undefined && leagueAlignment(year).get(s.teamAbbr)?.conference === conference)
    .sort((a, b) => a.seed! - b.seed!)
    .map((s) => s.teamAbbr);

describe("standings derived from the 1999–2001 schedule", () => {
  test("reads every game of the three seasons, old abbreviations mapped to today's teams", () => {
    expect(games.filter((g) => g.type === "REG")).toHaveLength(3 * 248);
    expect(games.filter((g) => g.type !== "REG")).toHaveLength(3 * 11);
    expect(games.some((g) => g.home === "LV" || g.home === "LAC" || g.home === "LAR")).toBe(true);
    expect(games.some((g) => ["OAK", "SD", "STL"].includes(g.home))).toBe(false);
    expect(importYears(2002, playoffs)).toEqual([1999, 2000, 2001]);
  });

  test("31 teams with records and points, no Houston", () => {
    const rows = season(2001);
    expect(rows).toHaveLength(31);
    expect(rows.some((r) => r.teamAbbr === "HOU")).toBe(false);
    expect(rows.reduce((n, r) => n + r.w, 0)).toBe(248);
    expect(team(2001, "NE")).toMatchObject({ w: 11, l: 5, t: 0, pointsFor: 371, pointsAgainst: 272 });
    expect(team(1999, "LAR")).toMatchObject({ w: 13, l: 3, pointsFor: 526, pointsAgainst: 242 });
  });

  test("2001: New England wins the AFC East on a tie with Miami, then Super Bowl XXXVI as the 2 seed", () => {
    expect(team(2001, "NE")).toMatchObject({ divisionRank: 1, seed: 2, playoffResult: "champion" });
    expect(team(2001, "MIA")).toMatchObject({ w: 11, divisionRank: 2, seed: 4, playoffResult: "wc_loss" });
    expect(seedsOf(2001, "AFC")).toEqual(["PIT", "NE", "LV", "MIA", "BAL", "NYJ"]);
    expect(seedsOf(2001, "NFC")).toEqual(["LAR", "CHI", "PHI", "GB", "SF", "TB"]);
    expect(team(2001, "LAR")).toMatchObject({ playoffResult: "sb_loss" });
  });

  test("1999: St. Louis wins it all as the NFC's top seed; Seattle wins the AFC West", () => {
    expect(team(1999, "LAR")).toMatchObject({ seed: 1, divisionRank: 1, playoffResult: "champion" });
    expect(seedsOf(1999, "AFC")).toEqual(["JAX", "IND", "SEA", "TEN", "BUF", "MIA"]);
    expect(seedsOf(1999, "NFC")).toEqual(["LAR", "TB", "WAS", "MIN", "DAL", "DET"]);
    expect(team(1999, "SEA")).toMatchObject({ w: 9, l: 7, divisionRank: 1 });
    // Tennessee went 13-3 behind Jacksonville in the Central and reached the Super Bowl.
    expect(team(1999, "TEN")).toMatchObject({ w: 13, divisionRank: 2, playoffResult: "sb_loss" });
  });

  test("2000: Baltimore wins the Super Bowl as a wild card", () => {
    expect(team(2000, "BAL")).toMatchObject({ seed: 4, divisionRank: 2, playoffResult: "champion" });
    expect(seedsOf(2000, "AFC")).toEqual(["TEN", "LV", "MIA", "BAL", "DEN", "IND"]);
    expect(seedsOf(2000, "NFC")).toEqual(["NYG", "MIN", "NO", "PHI", "TB", "LAR"]);
  });

  test("every division ranks 1 to its size; each conference has three division winners seeded 1–3", () => {
    for (const year of [1999, 2000, 2001]) {
      const rows = season(year);
      const winners = rows.filter((r) => r.divisionRank === 1);
      expect(winners).toHaveLength(6);
      expect(winners.every((r) => r.seed !== undefined && r.seed <= 3)).toBe(true);
      expect(rows.filter((r) => r.divisionRank === 6).map((r) => r.teamAbbr)).toHaveLength(1);
    }
  });

  test("the era's standings group into six divisions and rebuild the real bracket", () => {
    const alignment = leagueAlignment(2001);
    const rows = season(2001).map((s) => ({ ...s, ...alignment.get(s.teamAbbr)! }));
    const grouped = groupStandings(rows);
    expect(grouped.map((c) => c.divisions.map((d) => d.division))).toEqual([
      ["East", "Central", "West"],
      ["East", "Central", "West"],
    ]);
    expect(grouped[0]!.divisions[2]!.rows.map((r) => r.teamAbbr)).toContain("SEA");
    const bracket = buildBracket(rows);
    expect(bracket).toHaveLength(11);
    expect(bracket.filter((g) => g.round === "wc")).toHaveLength(4);
    expect(bracket.at(-1)).toMatchObject({ round: "sb", winner: "NE" });
    expect(bracket.find((g) => g.round === "div" && g.home.teamAbbr === "PIT")?.away.teamAbbr).toBe("BAL");
  });
});

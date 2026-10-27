import { describe, expect, test } from "vitest";
import { findTeamSeed, resolveTeamAbbr } from "../domain/teams";
import { alignmentFor, leagueAlignment, playoffByes } from "./alignment";

const at = (year: number, abbr: string) => alignmentFor(year, findTeamSeed(abbr)!);

describe("alignment by season", () => {
  test("1999–2001 read the six-division era, 2002 on today's eight", () => {
    expect(at(2001, "SEA")).toEqual({ conference: "AFC", division: "West" });
    expect(at(2002, "SEA")).toEqual({ conference: "NFC", division: "West" });
    expect(at(1999, "TB")).toEqual({ conference: "NFC", division: "Central" });
    expect(at(2000, "ARI")).toEqual({ conference: "NFC", division: "East" });
    expect(at(2001, "IND")).toEqual({ conference: "AFC", division: "East" });
    expect(at(2001, "LAR")).toEqual({ conference: "NFC", division: "West" });
    expect(at(2001, "NE")).toEqual({ conference: "AFC", division: "East" });
    // Not modelled before 1999: today's alignment.
    expect(at(1990, "SEA")).toEqual({ conference: "NFC", division: "West" });
  });

  test("31 teams in six divisions before Houston, 32 in eight after", () => {
    const old = leagueAlignment(2000);
    expect(old.size).toBe(31);
    expect(old.has("HOU")).toBe(false);
    const sizes = new Map<string, number>();
    for (const a of old.values())
      sizes.set(`${a.conference} ${a.division}`, (sizes.get(`${a.conference} ${a.division}`) ?? 0) + 1);
    expect([...sizes.values()].sort()).toEqual([5, 5, 5, 5, 5, 6]);
    expect(sizes.get("AFC Central")).toBe(6);
    expect(leagueAlignment(2002).size).toBe(32);
  });

  test("every era team is one of today's teams", () => {
    for (const abbr of leagueAlignment(1999).keys()) expect(findTeamSeed(abbr)?.abbr).toBe(abbr);
  });

  test("the era's abbreviations in nflverse files resolve to today's teams", () => {
    expect(["OAK", "SD", "SDG", "STL", "LVR", "LA"].map(resolveTeamAbbr)).toEqual([
      "LV",
      "LAC",
      "LAC",
      "LAR",
      "LV",
      "LAR",
    ]);
  });

  test("two byes per conference before 2020, one since", () => {
    expect(playoffByes(2001)).toBe(2);
    expect(playoffByes(2019)).toBe(2);
    expect(playoffByes(2020)).toBe(1);
  });
});

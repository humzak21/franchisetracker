import { describe, expect, test } from "vitest";
import { csvRecords, readCsv } from "./csv";
import { importYears, NFLVERSE_FIRST_YEAR, parsePlayoffs, parseStandings } from "./nflverse";
import { NFLVERSE_SAMPLE } from "./nflverseSample";
import { parseDraftPicks, parsePlayers, parseRoster } from "./nflversePlayers";
import { parseSeasonStats, statLineFromNflverse } from "./nflverseStats";

describe("csv", () => {
  test("reads quoted fields with commas, doubled quotes, line breaks and CRLF", () => {
    const text = 'a,b,c\r\n1,"x, y",""""\r\n2,"two\nlines",\n';
    expect([...csvRecords(text)]).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", '"'],
      ["2", "two\nlines", ""],
    ]);
  });

  test("keys rows by the requested columns; missing columns read as blank", () => {
    expect([...readCsv("a,b\n1,2\n", ["b", "z"])]).toEqual([{ b: "2", z: "" }]);
  });
});

describe("standings", () => {
  const playoffs = parsePlayoffs(NFLVERSE_SAMPLE.playoffGames);
  const standings = parseStandings(NFLVERSE_SAMPLE.standings, playoffs);

  test("maps records, seeds and playoff results to today's teams", () => {
    expect(standings).toHaveLength(64);
    expect(standings.find((s) => s.year === 2024 && s.teamAbbr === "PHI")).toEqual({
      year: 2024,
      teamAbbr: "PHI",
      w: 14,
      l: 3,
      t: 0,
      divisionRank: 1,
      seed: 2,
      playoffResult: "champion",
      pointsFor: 463,
      pointsAgainst: 303,
    });
    // nflverse calls the Rams "LA".
    expect(standings.some((s) => s.teamAbbr === "LAR")).toBe(true);
    expect(standings.find((s) => s.year === 2024 && s.teamAbbr === "NE")).toMatchObject({
      playoffResult: "missed",
      seed: undefined,
    });
  });

  test("playoff exits come from the playoff games, the Super Bowl decides the champion", () => {
    expect(playoffs.get(2025)?.get("SEA")).toBe("champion");
    expect(playoffs.get(2025)?.get("NE")).toBe("sb_loss");
    expect(playoffs.get(2025)?.get("BUF")).toBe("div_loss");
    expect(standings.find((s) => s.year === 2025 && s.teamAbbr === "NE")).toMatchObject({
      w: 14,
      seed: 2,
      playoffResult: "sb_loss",
    });
  });

  test("imports only finished seasons before the franchise's first", () => {
    expect(importYears(2026, playoffs)).toEqual([2024, 2025]);
    expect(importYears(2025, playoffs)).toEqual([2024]);
    expect(importYears(NFLVERSE_FIRST_YEAR, playoffs)).toEqual([]);
    const unfinished = parsePlayoffs(
      "season,game_type,away_team,away_score,home_team,home_score\n2026,WC,NE,20,BUF,17\n",
    );
    expect(unfinished.size).toBe(0);
  });
});

describe("season stats", () => {
  test("sums columns into registry totals and flips sack yardage", () => {
    const line = statLineFromNflverse({
      attempts: "584",
      completions: "368",
      sack_yards_lost: "-302",
      def_tackles_solo: "34",
      def_tackle_assists: "7",
      fg_made_50_59: "12",
      fg_made_60_: "2",
      fg_att: "47",
    });
    expect(line).toMatchObject({ passAtt: 584, passCmp: 368, passSackYds: 302, tackles: 41, fgm50plus: 14 });
  });

  test("leaves out categories the player never played", () => {
    // A running back who took one sack is not a passer.
    const line = statLineFromNflverse({
      carries: "345",
      rushing_yards: "2005",
      sacks_suffered: "1",
      attempts: "0",
    });
    expect(line).toEqual({ rushAtt: 345, rushYds: 2005 });
  });

  test("parses the sample rows", () => {
    const rows = parseSeasonStats(NFLVERSE_SAMPLE.seasonStats[2025].regular);
    const maye = rows.find((r) => r.position === "QB");
    expect(maye).toMatchObject({ teamAbbr: "NE", gamesPlayed: 17 });
    expect(maye!.totals.passAtt).toBeGreaterThan(400);
    expect(parseSeasonStats(NFLVERSE_SAMPLE.seasonStats[2024].postseason)).toEqual([]);
  });
});

describe("players, rosters and the draft", () => {
  test("players carry bio, ESPN id and draft slot", () => {
    const players = parsePlayers(NFLVERSE_SAMPLE.players, () => true);
    expect(players.find((p) => p.displayName === "Drake Maye")).toMatchObject({
      position: "QB",
      birthYear: 2002,
      espnId: 4431452,
      college: "North Carolina",
      draft: { year: 2024, round: 1, pick: 3, teamAbbr: "NE" },
    });
    expect(parsePlayers(NFLVERSE_SAMPLE.players, (p) => p.position === "QB")).toHaveLength(1);
  });

  test("roster rows keep players on the team and mark the club's own rookies", () => {
    const roster = parseRoster(NFLVERSE_SAMPLE.roster2026);
    const diggs = roster.find((r) => r.player.displayName === "Stefon Diggs");
    expect(diggs).toMatchObject({
      teamAbbr: "WAS",
      position: "WR",
      jersey: 3,
      status: "active",
      drafted: false,
    });
    expect(roster.every((r) => r.player.nflverseId.length > 0)).toBe(true);
  });

  test("draft picks resolve old abbreviations", () => {
    const picks = parseDraftPicks(NFLVERSE_SAMPLE.draftPicks, new Set([2024]));
    expect(picks.find((p) => p.name === "Drake Maye")).toMatchObject({
      year: 2024,
      round: 1,
      overall: 3,
      teamAbbr: "NE",
      position: "QB",
    });
    expect(picks.every((p) => p.year === 2024)).toBe(true);
  });
});

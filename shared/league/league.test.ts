import { describe, expect, test } from "vitest";
import { allPro, awardWeeks, cabinet, proBowl, weekWinners } from "../awards/groups";
import { gradeClass, gradePick } from "../draft/grade";
import { capSummary, formatMoney } from "../roster/cap";
import { buildBracket, championsOf, groupStandings, leagueTable, type StandingRow } from "./standings";

const row = (teamAbbr: string, conference: "AFC" | "NFC", extra: Partial<StandingRow>): StandingRow => ({
  teamAbbr,
  conference,
  division: "East",
  w: 10,
  l: 7,
  t: 0,
  ...extra,
});

/** A seven-seed field per conference: seed 1 rests, 2v7, 3v6, 4v5. */
const field: StandingRow[] = [
  row("KC", "AFC", { seed: 1, playoffResult: "sb_loss" }),
  row("BUF", "AFC", { seed: 2, playoffResult: "div_loss" }),
  row("BAL", "AFC", { seed: 3, playoffResult: "conf_loss" }),
  row("HOU", "AFC", { seed: 4, playoffResult: "wc_loss" }),
  row("LAC", "AFC", { seed: 5, playoffResult: "div_loss" }),
  row("PIT", "AFC", { seed: 6, playoffResult: "wc_loss" }),
  row("DEN", "AFC", { seed: 7, playoffResult: "wc_loss" }),
  row("NE", "AFC", { playoffResult: "missed" }),
  row("DET", "NFC", { seed: 1, playoffResult: "div_loss" }),
  row("PHI", "NFC", { seed: 2, playoffResult: "champion" }),
  row("LAR", "NFC", { seed: 3, playoffResult: "wc_loss" }),
  row("TB", "NFC", { seed: 4, playoffResult: "wc_loss" }),
  row("MIN", "NFC", { seed: 5, playoffResult: "div_loss" }),
  row("WAS", "NFC", { seed: 6, playoffResult: "conf_loss" }),
  row("GB", "NFC", { seed: 7, playoffResult: "wc_loss" }),
];

describe("league", () => {
  test("bracket rounds and champions", () => {
    const games = buildBracket(field);
    const winners = (round: string) => games.filter((g) => g.round === round).map((g) => g.winner);
    expect(winners("wc")).toEqual(["BUF", "BAL", "LAC", "PHI", "WAS", "MIN"]);
    // Re-seeded: the top seed plays the lowest seed left.
    expect(games.filter((g) => g.round === "div" && g.conference === "NFC").map((g) => g.winner)).toEqual([
      "WAS",
      "PHI",
    ]);
    expect(
      games
        .filter((g) => g.round === "div" && g.conference === "AFC")
        .map((g) => `${g.home.teamAbbr}-${g.away.teamAbbr}`),
    ).toEqual(["KC-LAC", "BUF-BAL"]);
    expect(games.find((g) => g.round === "sb")).toMatchObject({
      home: { teamAbbr: "KC" },
      away: { teamAbbr: "PHI" },
      winner: "PHI",
    });
    expect(championsOf(field)).toEqual({ afc: "KC", nfc: "PHI", superBowl: "PHI" });
  });

  test("six-seed seasons give two byes", () => {
    const six = field
      .filter((r) => r.seed !== 7)
      .map((r) => (r.teamAbbr === "BUF" ? { ...r, playoffResult: "div_loss" as const } : r));
    const wc = buildBracket(six).filter((g) => g.round === "wc" && g.conference === "AFC");
    expect(wc.map((g) => `${g.home.seed}-${g.away.seed}`)).toEqual(["3-6", "4-5"]);
  });

  test("standings by conference and division in finishing order", () => {
    const groups = groupStandings([
      row("NE", "AFC", { divisionRank: 2 }),
      row("BUF", "AFC", { divisionRank: 1 }),
      row("MIA", "AFC", { w: 3, l: 14 }),
    ]);
    expect(groups[0]!.divisions[0]!.rows.map((r) => r.teamAbbr)).toEqual(["BUF", "NE", "MIA"]);
  });

  test("the all-time table counts playoff wins without byes", () => {
    const table = leagueTable([
      { year: 2024, rows: field },
      { year: 2025, rows: field },
    ]);
    const kc = table.find((r) => r.teamAbbr === "KC")!;
    // Seed 1 rests in the wild card: two wins and a Super Bowl loss each year.
    expect(kc).toMatchObject({
      seasons: 2,
      playoffs: 2,
      playoffW: 4,
      playoffL: 2,
      conferenceTitles: 2,
      superBowls: 0,
    });
    expect(table[0]).toMatchObject({ teamAbbr: "PHI", playoffW: 8, playoffL: 0, superBowls: 2 });
    expect(table.find((r) => r.teamAbbr === "NE")).toMatchObject({ playoffs: 0, playoffW: 0 });
  });

  test("byes follow the season's format, also for one team's rows alone", () => {
    const one = (year: number, seed: number) => ({
      year,
      rows: [row("NE", "AFC", { seed, playoffResult: "conf_loss" })],
    });
    // A 2 seed rested before 2020 and plays the wild card round since; a 3 seed never rests.
    expect(leagueTable([one(2001, 2)])[0]).toMatchObject({ playoffW: 1 });
    expect(leagueTable([one(2024, 2)])[0]).toMatchObject({ playoffW: 2 });
    expect(leagueTable([one(2010, 3)])[0]).toMatchObject({ playoffW: 2 });
  });
});

describe("draft grades", () => {
  const base = { round: 1, ovrs: [74, 80, 84], gamesPlayed: 34, honors: 0, seasonsSince: 2 };
  test("waits two seasons, then grades the peak against the slot", () => {
    expect(gradePick({ ...base, seasonsSince: 1 })).toBeNull();
    expect(gradePick(base)).toEqual({ score: 64, letter: "C" });
    expect(gradePick({ ...base, ovrs: [92], honors: 2 })?.letter).toBe("A");
    expect(gradePick({ ...base, ovrs: [60], gamesPlayed: 2 })?.letter).toBe("F");
    expect(gradePick({ ...base, round: 7, ovrs: [74] })?.letter).toBe("B");
    // No OVR on record (real seasons): a starter who played every game is a solid pick.
    expect(gradePick({ ...base, ovrs: [], gamesPlayed: 29 })).toEqual({ score: 64, letter: "C" });
  });
  test("a class averages its graded picks", () => {
    expect(gradeClass([{ score: 90, letter: "A" }, null, { score: 50, letter: "D" }])).toEqual({
      score: 70,
      letter: "B",
    });
    expect(gradeClass([null])).toBeNull();
  });
});

describe("cap", () => {
  test("cap hits, space, expiring and unknown contracts", () => {
    const summary = capSummary(
      [
        { playerId: "a", contract: { apy: 9_000_000, expiresYear: 2026 } },
        { playerId: "b", contract: { total: 30_000_000, years: 3, expiresYear: 2028 } },
        { playerId: "c" },
      ],
      250_000_000,
      2026,
    );
    expect(summary).toMatchObject({
      committed: 19_000_000,
      space: 231_000_000,
      expiring: ["a"],
      unknown: ["c"],
    });
    expect(summary.hits.map((h) => h.playerId)).toEqual(["b", "a"]);
    expect([formatMoney(9_200_000), formatMoney(750_000), formatMoney(-2_500_000)]).toEqual([
      "$9.2M",
      "$750K",
      "−$2.5M",
    ]);
  });
});

describe("awards", () => {
  const awards = [
    {
      type: "OPOW" as const,
      weekKey: "w2" as const,
      conference: "AFC" as const,
      scope: "conference" as const,
    },
    {
      type: "DPOW" as const,
      weekKey: "w1" as const,
      conference: "NFC" as const,
      scope: "conference" as const,
    },
    { type: "MVP" as const, scope: "league" as const },
    { type: "AllPro1" as const, position: "WR" as const, scope: "league" as const },
    { type: "AllPro1" as const, position: "QB" as const, scope: "league" as const },
    {
      type: "ProBowl" as const,
      conference: "NFC" as const,
      position: "CB" as const,
      scope: "conference" as const,
    },
  ];
  test("weekly grid, cabinet, All-Pro and Pro Bowl", () => {
    expect(awardWeeks(awards)).toEqual(["w1", "w2"]);
    const w2 = weekWinners(awards, "w2");
    expect(w2[0]!.awards[0]!.winners).toHaveLength(1);
    expect(
      cabinet(awards)
        .filter((g) => g.winners.length > 0)
        .map((g) => g.type),
    ).toEqual(["MVP"]);
    expect(cabinet(awards, ["MVP", "FPOY"]).map((g) => g.winners.length)).toEqual([1, 0]);
    expect(allPro(awards)[0]!.players.map((p) => p.position)).toEqual(["QB", "WR"]);
    expect(proBowl(awards).map((g) => g.players.length)).toEqual([0, 1]);
  });
});

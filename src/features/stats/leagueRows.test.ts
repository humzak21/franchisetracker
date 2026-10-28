import { describe, expect, it } from "vitest";
import { statGroup } from "@shared/stats";
import { leagueRows } from "./leagueRows";

const team = (abbr: string) => ({
  _id: abbr,
  abbr,
  city: abbr,
  name: abbr,
  primaryColor: "#000000",
  secondaryColor: "#ffffff",
});
const row = (
  name: string,
  position: string,
  teamId: string,
  isUser: boolean,
  totals: Record<string, number>,
) => ({
  playerId: name,
  name,
  position,
  teamId,
  isUser,
  source: isUser ? "logs" : "reported",
  gamesPlayed: 5,
  totals,
});
// Ids are plain strings here; the query's branded ids only matter to Convex.
const data = {
  teams: [team("NE"), team("BUF")],
  rows: [
    row("Drake Maye", "QB", "NE", true, { passYds: 1403 }),
    row("Josh Allen", "QB", "BUF", false, { passYds: 1320 }),
    row("James Cook", "HB", "BUF", false, { rushYds: 455, kickReturnYds: 40 }),
  ],
} as unknown as Parameters<typeof leagueRows>[0];

describe("leagueRows", () => {
  it("takes the group's positions and filters to whose players", () => {
    expect(leagueRows(data, statGroup("qb"), "all").map((r) => r.name)).toEqual(["Drake Maye", "Josh Allen"]);
    expect(leagueRows(data, statGroup("qb"), "ours").map((r) => r.name)).toEqual(["Drake Maye"]);
    expect(leagueRows(data, statGroup("qb"), "others")[0]).toMatchObject({
      name: "Josh Allen",
      team: { abbr: "BUF" },
    });
  });

  it("lists anyone with return stats as a returner, fantasy points aside", () => {
    expect(leagueRows(data, statGroup("returns"), "all").map((r) => r.name)).toEqual(["James Cook"]);
  });
});

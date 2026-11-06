/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { setup as setupFranchise } from "../players/identityEra.setup";

const modules = import.meta.glob("/convex/**/*.ts");
const setup = () => setupFranchise(modules);

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("candidates found by name carry their roster context", () => {
  test("a search hit knows its team this season and last", async () => {
    const { t, franchiseId, first, later, addPlayer, teamId } = await setup();
    const stafford = await addPlayer({
      firstName: "John",
      lastName: "Stafford",
      displayName: "Matthew Stafford",
      position: "QB",
    });
    const [lar, det] = [await teamId("LAR"), await teamId("DET")];
    await t.run(async (ctx) => {
      const entry = { franchiseId, playerId: stafford, position: "QB" as const, status: "active" as const };
      await ctx.db.insert("rosterEntries", { ...entry, seasonId: later, teamId: lar });
      await ctx.db.insert("rosterEntries", { ...entry, seasonId: first, teamId: det });
    });
    const pool = await t.query(internal.ingestion.candidates.forNames, {
      seasonId: later,
      teamAbbrs: [],
      names: ["M. Stafford"],
    });
    expect(pool.find((c) => c.playerId === stafford)).toMatchObject({
      teamAbbr: "LAR",
      lastTeamAbbr: "DET",
      inactive: false,
    });
  });

  test("with the league's rosters in, a player on none of them is out of the league", async () => {
    const { t, franchiseId, later, addPlayer } = await setup();
    const rostered = await addPlayer({
      firstName: "Jaylinn",
      lastName: "Hawkins",
      displayName: "Jaylinn Hawkins",
    });
    const free = await addPlayer({ firstName: "Josh", lastName: "Hawkins", displayName: "Josh Hawkins" });
    await t.run(async (ctx) => {
      const teams = await ctx.db.query("teams").take(64);
      for (const [i, team] of teams.entries()) {
        const playerId: Id<"players"> =
          i === 0
            ? rostered
            : await ctx.db.insert("players", {
                franchiseId,
                firstName: "Filler",
                lastName: `Player${i}`,
                displayName: `Filler Player${i}`,
                position: "WR",
                isReal: false,
                retired: false,
                aliases: [],
              });
        await ctx.db.insert("rosterEntries", {
          franchiseId,
          seasonId: later,
          teamId: team._id,
          playerId,
          position: "WR",
          status: "active",
        });
      }
    });
    const pool = await t.query(internal.ingestion.candidates.forNames, {
      seasonId: later,
      teamAbbrs: [],
      names: ["J.Hawkins"],
    });
    expect(pool.find((c) => c.playerId === rostered)?.inLeague).toBe(true);
    expect(pool.find((c) => c.playerId === free)).toMatchObject({ inLeague: false, teamAbbr: null });
  });
});

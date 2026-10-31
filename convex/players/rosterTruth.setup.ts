/// <reference types="vite/client" />
/** Shared by the roster tests. Two dots in the name keep it out of what Convex bundles. */
import { convexTest } from "convex-test";
import { vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { MAX_ROSTER } from "../lib/franchise";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

export const FIRST = SAMPLE_START_YEAR;

export async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const season = (year: number) => active.seasons.find((s) => s.year === year)!._id;
  const userTeamId = active.franchise.userTeamId;
  const franchiseId = active.franchise._id;
  const teams = await t.run((ctx) => ctx.db.query("teams").take(40));
  const userTeam = teams.find((x) => x._id === userTeamId)!;
  const otherTeam = teams.find((x) => x._id !== userTeamId)!;
  const roster = (seasonId: Id<"seasons">, teamId: Id<"teams"> = userTeamId) =>
    t.run((ctx) =>
      ctx.db
        .query("rosterEntries")
        .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", teamId))
        .take(MAX_ROSTER + 1),
    );
  /** Types a roster page in: the given players plus enough filler rows to make the count. */
  const commitPage = async (
    seasonId: Id<"seasons">,
    players: readonly Doc<"rosterEntries">[],
    options: { abbr?: string; filler?: number; partial?: boolean } = {},
  ) => {
    const draftId = await owner.mutation(api.ingestion.manual.create, { targetKey: "roster_page", seasonId });
    const entry = (await owner.query(api.ingestion.manual.get, { draftId }))!;
    if (!("rows" in entry.draft)) throw new Error("not a row draft");
    const row = (id: string, name: string, playerId: Id<"players"> | null, position: string) => ({
      id,
      accepted: true,
      name,
      teamAbbr: null,
      values: { position, ovr: 70 },
      playerId,
      match: null,
      confirmedNew: true,
    });
    const named = await t.run((ctx) => Promise.all(players.map((p) => ctx.db.get("players", p.playerId))));
    const rows = [
      ...players.map((p, i) => row(`p${i}`, named[i]!.displayName, p.playerId, p.position)),
      ...Array.from({ length: options.filler ?? 0 }, (_, i) => row(`f${i}`, `Filler Player${i}`, null, "WR")),
    ];
    await owner.mutation(api.ingestion.manualCommit.commit, {
      draftId,
      draft: {
        ...entry.draft,
        meta: { ...entry.draft.meta, team: options.abbr ?? userTeam.abbr, partial: options.partial ?? null },
        rows,
      },
    });
  };
  const nextSeason = async () => {
    const seasonId = season(FIRST + 1);
    await owner.mutation(api.players.carryOver.fromPreviousSeason, { seasonId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return seasonId;
  };
  return {
    t,
    owner,
    active,
    season,
    roster,
    userTeamId,
    franchiseId,
    userTeam,
    otherTeam,
    commitPage,
    nextSeason,
  };
}

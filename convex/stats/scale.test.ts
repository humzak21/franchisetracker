/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";
import { DEFAULT_QUESTION, MAX_SCAN_SEASONS } from "../../shared/stats";
import { seasonBoards } from "./boardCandidates";
import { answerQuestion } from "./explorer";
import { playerLines } from "./load";
import { performancePage } from "./performance";
import { rebuildPlayer } from "./recompute";
import { refreshAfterGame } from "./refresh";
import { refreshRecords } from "./refreshRecords";
import {
  FUNCTION_LIMITS,
  GAMES_PER_SEASON,
  insertPlayer,
  LIFERS,
  metered,
  SEASONS,
  seedSeason,
  type Used,
} from "./scale.setup";
import { playerSplits, teamSplits } from "./splits";
import { writeTeamRecords } from "./teamRecords";

const modules = import.meta.glob("/convex/**/*.ts");

/** Twenty seasons take a while to seed and rebuild under convex-test, which scans on every read. */
const TIMEOUT = 300_000;

function withinLimits(step: string, used: Used) {
  console.info(`${step}: ${JSON.stringify(used)}`);
  expect(used.docsRead, `${step} reads`).toBeLessThan(FUNCTION_LIMITS.docsRead);
  expect(used.bytesRead, `${step} bytes`).toBeLessThan(FUNCTION_LIMITS.bytesRead);
  expect(used.docsWritten, `${step} writes`).toBeLessThan(FUNCTION_LIMITS.docsWritten);
}

async function seed() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const owner = await asOwner(t);
  const franchise = (await owner.query(api.franchise.franchises.getActive, {}))!.franchise;
  const lifers = await t.run(async (ctx) => {
    const ids: Id<"players">[] = [];
    for (let i = 0; i < LIFERS; i++) ids.push(await insertPlayer(ctx, franchise, `Lifer ${i}`));
    return ids;
  });
  let last: Awaited<ReturnType<typeof seedSeason>> | undefined;
  for (let i = 1; i <= SEASONS; i++) {
    last = await t.run((ctx) => seedSeason(ctx, franchise, SAMPLE_START_YEAR + i, i, lifers));
  }
  await owner.mutation(api.stats.rebuild.start, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, owner, franchise, lifers, last: last! };
}

type Seeded = Awaited<ReturnType<typeof seed>>;

const measure = async (t: Seeded["t"], step: string, work: (ctx: MutationCtx) => Promise<unknown>) => {
  const used = await t.run(async (raw) => {
    const { ctx, used } = metered(raw);
    await work(ctx);
    return used;
  });
  withinLimits(step, used);
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a 20-season franchise", () => {
  test(
    "keeps inside a function's limits everywhere a game or a rebuild touches, and loses nothing",
    async () => {
      const { t, owner, franchise, lifers, last } = await seed();
      const { lastGame, lastLines, lastSeason } = last;
      const liferId = lifers[0]!;
      const lifer = (await t.run((ctx) => ctx.db.get("players", liferId))) as Doc<"players">;

      await measure(t, "after a game", (ctx) => refreshAfterGame(ctx, lastGame, lastLines));
      await measure(t, "a career rebuilt", (ctx) => rebuildPlayer(ctx, lifer));
      await measure(t, "the franchise book", (ctx) => refreshRecords(ctx, franchise, null));
      await measure(t, "a season's boards", (ctx) => seasonBoards(ctx, franchise, lastSeason));
      await measure(t, "a page of marks and spans", (ctx) => performancePage(ctx, franchise, null));
      await measure(t, "a season's team records", (ctx) => writeTeamRecords(ctx, franchise, lastSeason));
      await measure(t, "the team's splits, every season", (ctx) => teamSplits(ctx, franchise, "all"));
      await measure(t, "a career's splits", (ctx) => playerSplits(ctx, franchise, liferId, "all"));
      const asked = { ...DEFAULT_QUESTION, statKey: "rushYds" as const };
      await measure(t, "a question on season rows, every season", (ctx) =>
        answerQuestion(ctx, franchise, { ...asked, scope: "career" }),
      );
      await measure(t, "the widest question that reads games", (ctx) =>
        answerQuestion(ctx, franchise, {
          ...asked,
          scope: "game",
          split: "home",
          fromYear: lastSeason.year - MAX_SCAN_SEASONS + 1,
          toYear: lastSeason.year,
        }),
      );
      await measure(t, "one player's question, a whole career", (ctx) =>
        answerQuestion(ctx, franchise, { ...asked, scope: "span", split: "home", playerId: liferId }),
      );
      const wide = await t.run((ctx) =>
        answerQuestion(ctx, franchise, { ...asked, scope: "game", split: "home" }),
      );
      expect(wide).toHaveProperty("refused");

      // The cap on a career's lines holds twenty seasons of every game, playoffs included.
      const lines = await t.run((ctx) => playerLines(ctx, liferId));
      expect(lines).toHaveLength(SEASONS * GAMES_PER_SEASON);

      const career = await t.run((ctx) =>
        ctx.db
          .query("careerPlayerStats")
          .withIndex("by_playerId", (q) => q.eq("playerId", liferId))
          .take(4),
      );
      expect(career.find((c) => c.split === "regular")?.gamesPlayed).toBe(SEASONS * 17);
      expect(await owner.query(api.stats.recordBuild.status, {})).toMatchObject({ status: "done" });

      // The heaviest reads on the new screens, for the player with the longest career.
      const streaks = await owner.query(api.stats.streaks.longest, {});
      expect(streaks.players.find((l) => l.key === "appearances")?.entries[0]?.longest).toBe(
        SEASONS * GAMES_PER_SEASON,
      );
      const timeline = await owner.query(api.stats.milestones.forPlayer, { playerId: liferId });
      expect(timeline.filter((i) => i.kind === "mark").length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});

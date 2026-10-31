import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { KEEP_FOREVER } from "../../shared/ops/retention";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asStranger } from "../lib/testOwner";
import { setup } from "./operations.setup";

const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("the nightly tidy", () => {
  async function aged() {
    const context = await setup();
    const { t, send, finish } = context;
    const setKey = await send("old");
    await finish();
    const age = async (status: "committed" | "rejected", days: number) =>
      await t.run(async (ctx) => {
        const uploads = await ctx.db.query("uploads").collect();
        for (const u of uploads) {
          if (u.setKey === setKey) {
            await ctx.db.patch("uploads", u._id, { status, createdAt: Date.now() - days * DAY });
          }
        }
      });
    const count = () =>
      t.run(async (ctx) => ({
        uploads: (await ctx.db.query("uploads").collect()).filter((u) => u.setKey === setKey).length,
        extractions: (await ctx.db.query("extractions").collect()).filter((e) => e.setKey === setKey).length,
      }));
    return { ...context, setKey, age, count };
  }

  test("deletes an aged committed set with its read, and says so", async () => {
    const { t, owner, age, count, finish } = await aged();
    await age("committed", 181);
    expect(await count()).toEqual({ uploads: 1, extractions: 1 });
    await t.mutation(internal.ops.retention.nightly, {});
    await finish();
    expect(await count()).toEqual({ uploads: 0, extractions: 0 });
    const { jobs } = await owner.query(api.ops.maintenance.status, {});
    expect(jobs.find((j) => j.job === "screenshots")?.last).toMatchObject({
      status: "done",
      summary: "Deleted 1 set of screenshots",
    });
  });

  test("leaves one younger than the setting, or anything when set to keep forever", async () => {
    const { t, owner, age, count, finish } = await aged();
    await age("committed", 100);
    await t.mutation(internal.ops.retention.nightly, {});
    await finish();
    expect((await count()).uploads).toBe(1);

    await age("committed", 5000);
    await owner.mutation(api.ops.maintenance.setKeepDays, { days: KEEP_FOREVER });
    await t.mutation(internal.ops.retention.nightly, {});
    await finish();
    expect((await count()).uploads).toBe(1);
  });

  test("rejected screenshots go sooner; one still in review stays however old", async () => {
    const { t, age, count, finish } = await aged();
    await t.run(async (ctx) => {
      for (const u of await ctx.db.query("uploads").collect()) {
        await ctx.db.patch("uploads", u._id, { createdAt: Date.now() - 900 * DAY });
      }
    });
    await t.mutation(internal.ops.retention.nightly, {});
    await finish();
    expect((await count()).uploads).toBe(1);

    await age("rejected", 31);
    await t.mutation(internal.ops.retention.nightly, {});
    await finish();
    expect((await count()).uploads).toBe(0);
  });

  test("keeps milestones, acknowledged or not", async () => {
    const { t, owner, finish } = await setup();
    await finish();
    const before = await t.run(async (ctx) => (await ctx.db.query("milestones").collect()).length);
    const [first] = await owner.query(api.stats.milestones.feed, {});
    if (first) await owner.mutation(api.stats.milestones.acknowledge, { milestoneIds: [first._id] });
    await t.mutation(internal.ops.retention.nightly, {});
    await finish();
    expect(await t.run(async (ctx) => (await ctx.db.query("milestones").collect()).length)).toBe(before);
  });
});

describe("scheduled job errors", () => {
  async function failOnce(t: Awaited<ReturnType<typeof setup>>["t"], finish: () => Promise<void>) {
    const gone = await t.run(async (ctx) => {
      const id = await ctx.db.insert("franchises", {
        name: "Gone",
        userTeamId: (await ctx.db.query("teams").first())!._id,
        startYear: 2000,
        settings: { gamesPerSeason: 17, playoffTeams: 14 },
        isActive: false,
      });
      await ctx.db.delete("franchises", id);
      return id;
    });
    await t.run((ctx) => ctx.scheduler.runAfter(0, internal.stats.scoring.boards, { franchiseId: gone }));
    await finish();
  }

  test("a failed job is filed by name, once however often the sweep looks", async () => {
    const { t, owner, finish } = await setup();
    await finish();
    await failOnce(t, finish);
    expect(await t.mutation(internal.ops.errors.sweepScheduled, {})).toBe(1);
    expect(await t.mutation(internal.ops.errors.sweepScheduled, {})).toBe(0);
    const reports = await owner.query(api.ops.errors.recent, {});
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ kind: "scheduled", count: 1 });
    expect(reports[0]?.path).toContain("scoring");
  });

  test("seen stays seen until it happens again", async () => {
    const { t, owner, finish } = await setup();
    await finish();
    await failOnce(t, finish);
    await t.mutation(internal.ops.errors.sweepScheduled, {});
    const [report] = await owner.query(api.ops.errors.recent, {});
    await owner.mutation(api.ops.errors.markSeen, { ids: [report!._id] });
    const [seen] = await owner.query(api.ops.errors.recent, {});
    expect(seen?.seenAt).toBeGreaterThanOrEqual(seen!.lastSeen);

    vi.advanceTimersByTime(60_000);
    await failOnce(t, finish);
    await t.mutation(internal.ops.errors.sweepScheduled, {});
    const [again] = await owner.query(api.ops.errors.recent, {});
    expect(again?.count).toBe(2);
    expect(again!.lastSeen).toBeGreaterThan(again!.seenAt!);
  });
});

describe("maintenance", () => {
  test("a preview changes nothing, and running writes the last run", async () => {
    const { t, owner, finish } = await setup();
    await finish();
    const captions = () =>
      t.run(async (ctx) =>
        (await ctx.db.query("games").collect())
          .flatMap((g) => g.stars ?? [])
          .flatMap((s) => (s.caption ? [s.caption] : [])),
      );
    await t.run(async (ctx) => {
      const line = await ctx.db.query("gameStatLines").first();
      const game = (await ctx.db.get("games", line!.gameId))!;
      const star = { playerId: line!.playerId, teamId: line!.teamId, caption: "22/30, 284 yds, 3 TD" };
      await ctx.db.patch("games", game._id, { stars: [star] });
    });
    const typed = "22/30, 284 yds, 3 TD";
    const preview = await owner.mutation(api.ops.maintenance.preview, { job: "starLines" });
    expect(preview.lines.some((l) => l.endsWith(typed))).toBe(true);
    expect(await captions()).toContain(typed);

    await owner.mutation(api.ops.maintenance.run, { job: "starLines" });
    expect(await captions()).not.toContain(typed);
    const { jobs } = await owner.query(api.ops.maintenance.status, {});
    expect(jobs.find((j) => j.job === "starLines")?.last?.status).toBe("done");
    const again = await owner.mutation(api.ops.maintenance.preview, { job: "starLines" });
    expect(again.summary).toBe("0 captions");
  });

  test("team totals run in the background and report back", async () => {
    const { owner, finish } = await setup();
    await finish();
    await owner.mutation(api.ops.maintenance.run, { job: "teamTotals" });
    const running = await owner.query(api.ops.maintenance.status, {});
    expect(running.jobs.find((j) => j.job === "teamTotals")?.last?.status).toBe("running");
    await finish();
    const done = await owner.query(api.ops.maintenance.status, {});
    expect(done.jobs.find((j) => j.job === "teamTotals")?.last).toMatchObject({
      status: "done",
      summary: "Recounted 1 season",
    });
  });

  test("Rebuild stats reads as the records build", async () => {
    const { owner, finish } = await setup();
    await finish();
    await owner.mutation(api.ops.maintenance.run, { job: "rebuildStats" });
    const { jobs } = await owner.query(api.ops.maintenance.status, {});
    expect(jobs.find((j) => j.job === "rebuildStats")?.last?.status).toBe("running");
    await finish();
  }, 120_000);

  test("a misread name is checked first, and refused when it names nobody", async () => {
    const { owner } = await setup();
    const none = await owner.mutation(api.ops.maintenance.fixMisread, {
      dryRun: true,
      year: SAMPLE_START_YEAR,
      name: "Nobody Atall",
      teamAbbr: "NE",
    });
    expect(none).toMatchObject({ done: false, problem: "0 players named Nobody Atall" });
  });

  test("only the keep choices on offer are accepted", async () => {
    const { owner } = await setup();
    await expect(owner.mutation(api.ops.maintenance.setKeepDays, { days: 7 })).rejects.toThrow(/choices/);
  });

  test("strangers are refused", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.query(api.ops.maintenance.status, {})).rejects.toThrow();
    await expect(stranger.mutation(api.ops.maintenance.run, { job: "starLines" })).rejects.toThrow();
    await expect(stranger.mutation(api.ops.maintenance.preview, { job: "starLines" })).rejects.toThrow();
    await expect(stranger.mutation(api.ingestion.budget.set, { budgetUsd: 5 })).rejects.toThrow();
    await expect(stranger.mutation(api.ops.errors.markSeen, { ids: [] })).rejects.toThrow();
    await expect(stranger.mutation(api.ops.restoreData.rebuild, { franchiseIds: [] })).rejects.toThrow();
  });
});

describe("what lists could not count", () => {
  test("a played game with no box score is named, season by season", async () => {
    const { t, owner, finish } = await setup();
    await finish();
    expect(await owner.query(api.stats.reconcile.missingBoxScores, {})).toEqual([]);
    await t.run(async (ctx) => {
      const game = (await ctx.db.query("games").collect()).find(
        (g) => g.status === "played" && g.weekKey === "w2",
      )!;
      for (const line of await ctx.db.query("gameStatLines").collect()) {
        if (line.gameId === game._id) await ctx.db.delete("gameStatLines", line._id);
      }
    });
    expect(await owner.query(api.stats.reconcile.missingBoxScores, {})).toEqual([
      { year: SAMPLE_START_YEAR, weeks: ["w2"] },
    ]);
  });
});

describe("the game a mark was reached in", () => {
  test("its box score and the player's game log both carry it", async () => {
    const { t, owner, finish } = await setup();
    await finish();
    const mark = await t.run(async (ctx) => {
      const row = (await ctx.db.query("playerMarks").collect()).find(
        (m) => m.statKey === "passYds" && m.mark === 1000 && m.horizon === "season",
      );
      return row!;
    });
    const marks = await owner.query(api.stats.marks.forGame, { gameId: mark.gameId });
    expect(marks.find((m) => m.player.name === "Drake Maye")).toMatchObject({
      label: "1,000 passing yards",
      gamesToReach: mark.gamesToReach,
    });
    const log = await owner.query(api.players.gameLog.bySeason, {
      playerId: mark.playerId,
      seasonId: mark.seasonId,
    });
    expect(log.find((g) => g.gameId === mark.gameId)?.marks).toContain("1,000 passing yards");
    expect(log.filter((g) => g.gameId !== mark.gameId).flatMap((g) => g.marks)).not.toContain(
      "1,000 passing yards",
    );
  });
});

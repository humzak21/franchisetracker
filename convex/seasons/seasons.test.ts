/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { refreshSeasonRecord } from "../ingestion/commitGame";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const season = (year: number) => active.seasons.find((s) => s.year === year)!;
  return { t, owner, active, season };
}

describe("season lifecycle", () => {
  test("a played Super Bowl completes the season and settles the result", async () => {
    const { t, active, season } = await setup();
    const seasonId = season(SAMPLE_START_YEAR)._id;
    const opponent = (await t.run((ctx) => ctx.db.query("teams").take(2))).find(
      (team) => team._id !== active.franchise.userTeamId,
    )!;
    await t.run(async (ctx) => {
      for (const [weekKey, us, them] of [
        ["wc", 24, 10],
        ["sb", 31, 28],
      ] as const) {
        await ctx.db.insert("games", {
          franchiseId: active.franchise._id,
          seasonId,
          weekKey,
          homeTeamId: active.franchise.userTeamId,
          awayTeamId: opponent._id,
          opponentTeamId: opponent._id,
          userIsHome: true,
          homeScore: us,
          awayScore: them,
          status: "played",
        });
      }
      await refreshSeasonRecord(ctx, seasonId);
    });
    const updated = await t.run((ctx) => ctx.db.get("seasons", seasonId));
    expect(updated).toMatchObject({
      status: "complete",
      userRecord: { w: 4, l: 1, playoffResult: "champion" },
    });
  });

  test("finishing by hand makes the post-season report due; advancing starts the next season", async () => {
    const { t, owner, season } = await setup();
    const finished = season(SAMPLE_START_YEAR)._id;
    await expect(owner.mutation(api.seasons.lifecycle.advance, { seasonId: finished })).rejects.toThrow(
      /Finish the 2026 season first/,
    );
    await owner.mutation(api.seasons.lifecycle.finish, { seasonId: finished });
    await owner.mutation(api.seasons.lifecycle.finish, { seasonId: finished });
    expect(await t.run((ctx) => ctx.db.get("seasons", finished))).toMatchObject({
      status: "complete",
      userRecord: { w: 4, l: 1, playoffResult: "missed" },
    });
    const { prompts } = await owner.query(api.seasons.reports.pending, {});
    expect(prompts.map((p) => [p.year, p.prompt])).toEqual([
      [2026, "postseason"],
      [2027, "preseason"],
    ]);

    const next = season(SAMPLE_START_YEAR + 1)._id;
    await expect(owner.mutation(api.seasons.lifecycle.finish, { seasonId: next })).rejects.toThrow(
      /has not started yet/,
    );
    await t.run((ctx) => ctx.db.patch("seasons", next, { status: "complete" }));
    const added = await owner.mutation(api.seasons.lifecycle.advance, { seasonId: next });
    expect(await owner.mutation(api.seasons.lifecycle.advance, { seasonId: next })).toBe(added);
    const created = await t.run((ctx) => ctx.db.get("seasons", added));
    expect(created).toMatchObject({ year: 2028, status: "upcoming", coaching: { headCoach: "Mike Vrabel" } });
    const due = await owner.query(api.seasons.reports.pending, {});
    expect(due.prompts.map((p) => [p.year, p.prompt])).toEqual([
      [2027, "postseason"],
      [2028, "preseason"],
    ]);
  });

  test("real NFL seasons and strangers are refused", async () => {
    const { t, owner, season } = await setup();
    await expect(
      owner.mutation(api.seasons.lifecycle.finish, { seasonId: season(2024)._id }),
    ).rejects.toThrow(/real NFL history/);
    const stranger = await asStranger(t);
    await expect(
      stranger.mutation(api.seasons.lifecycle.finish, { seasonId: season(SAMPLE_START_YEAR)._id }),
    ).rejects.toThrow(/Not the owner/);
  });
});

describe("season reports", () => {
  test("a prompt stays due through dismissal and drops off once filed", async () => {
    const { owner, season } = await setup();
    const seasonId = season(SAMPLE_START_YEAR)._id;
    const before = await owner.query(api.seasons.reports.pending, {});
    expect(before.prompts).toEqual([{ seasonId, year: 2026, prompt: "preseason" }]);

    await owner.mutation(api.seasons.reports.dismiss, { seasonId, prompt: "preseason" });
    const dismissed = await owner.query(api.seasons.reports.pending, {});
    expect(dismissed.prompts).toMatchObject([
      { seasonId, prompt: "preseason", dismissedAt: expect.any(Number) },
    ]);

    await expect(
      owner.mutation(api.seasons.reports.answer, { seasonId, prompt: "preseason" }),
    ).rejects.toThrow(/Write the report/);
    await owner.mutation(api.seasons.reports.saveText, {
      seasonId,
      field: "preseasonThoughts",
      text: "Win the East.",
    });
    await owner.mutation(api.seasons.reports.answer, { seasonId, prompt: "preseason" });
    expect((await owner.query(api.seasons.reports.pending, {})).prompts).toEqual([]);
    await expect(
      owner.mutation(api.seasons.reports.answer, { seasonId, prompt: "postseason" }),
    ).rejects.toThrow(/not over yet/);

    const report = await owner.query(api.seasons.reports.get, { seasonId });
    expect(report.report).toMatchObject({
      preseasonThoughts: "Win the East.",
      prompts: { preseason: { status: "answered" } },
    });
    expect(report.summary).toMatchObject({ regular: { w: 4, l: 1 }, pointsFor: 140, played: 5 });
    expect(report.leaders.find((l) => l.stat === "passYds")?.player.displayName).toBe("Drake Maye");
    const archive = await owner.query(api.seasons.reports.archive, {});
    expect(archive.map((a) => a.season.year)).toEqual([2027, 2026]);
    expect(archive[1]).toMatchObject({ preseason: { answered: true, snippet: "Win the East." } });
  });

  test("real NFL seasons have no report", async () => {
    const { owner, season } = await setup();
    await expect(
      owner.mutation(api.seasons.reports.saveText, {
        seasonId: season(2025)._id,
        field: "aroundTheLeague",
        text: "x",
      }),
    ).rejects.toThrow(/real NFL history/);
  });

  test("staff saves trimmed and clears", async () => {
    const { t, owner, season } = await setup();
    const seasonId = season(SAMPLE_START_YEAR + 1)._id;
    await owner.mutation(api.seasons.staff.update, {
      seasonId,
      coaching: { headCoach: "  Bill Belichick ", offensiveScheme: "" },
    });
    expect((await t.run((ctx) => ctx.db.get("seasons", seasonId)))!.coaching).toEqual({
      headCoach: "Bill Belichick",
    });
    await owner.mutation(api.seasons.staff.update, { seasonId, coaching: {} });
    expect((await t.run((ctx) => ctx.db.get("seasons", seasonId)))!.coaching).toBeUndefined();
  });
});

describe("offseason needs", () => {
  test("needs are written, show as open, resolve and reopen", async () => {
    const { t, owner, active, season } = await setup();
    const seasonId = season(SAMPLE_START_YEAR)._id;
    const key = await owner.mutation(api.seasons.needs.add, {
      seasonId,
      position: "CB",
      priority: "high",
      note: " Shutdown corner ",
    });
    await owner.mutation(api.seasons.needs.add, { seasonId, position: "LT", priority: "medium" });
    expect((await owner.query(api.seasons.reports.pending, {})).needs).toMatchObject([
      { year: 2026, position: "CB", priority: "high", note: "Shutdown corner" },
      { year: 2026, position: "LT" },
    ]);

    await owner.mutation(api.seasons.needs.resolve, {
      seasonId,
      key,
      by: { kind: "note", note: "Traded for one" },
    });
    expect((await owner.query(api.seasons.reports.pending, {})).needs.map((n) => n.position)).toEqual(["LT"]);

    const next = season(SAMPLE_START_YEAR + 1)._id;
    const pickId = await t.run((ctx) =>
      ctx.db.insert("draftPicks", {
        franchiseId: active.franchise._id,
        seasonId: next,
        round: 1,
        overall: 21,
        teamId: active.franchise.userTeamId,
        rawName: "Rookie Corner",
      }),
    );
    expect((await owner.query(api.seasons.needs.candidates, { seasonId })).draftPicks).toEqual([
      { _id: pickId, label: "Rd 1, #21 · Rookie Corner", notes: undefined },
    ]);
    await owner.mutation(api.seasons.needs.resolve, {
      seasonId,
      key,
      by: { kind: "draftPick", draftPickId: pickId },
    });
    const report = await owner.query(api.seasons.reports.get, { seasonId });
    const need = report.report!.needs.find((n) => n.key === key)!;
    expect(need).toMatchObject({ resolvedByDraftPickId: pickId });
    expect(need.resolvedNote).toBeUndefined();
    expect(report.resolutions).toEqual([{ key, label: "Rd 1, #21 · Rookie Corner" }]);

    await owner.mutation(api.seasons.needs.reopen, { seasonId, key });
    await owner.mutation(api.seasons.needs.update, { seasonId, key, priority: "low" });
    expect(
      (await owner.query(api.seasons.reports.pending, {})).needs.map((n) => [n.position, n.priority]),
    ).toEqual([
      ["CB", "low"],
      ["LT", "medium"],
    ]);
    await owner.mutation(api.seasons.needs.remove, { seasonId, key });
    await expect(owner.mutation(api.seasons.needs.remove, { seasonId, key })).rejects.toThrow(
      /Need not found/,
    );
  });
});

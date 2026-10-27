/// <reference types="vite/client" />
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const token = await owner.action(api.ingestion.tokens.create, { label: "iPhone" });
  const headers = { Authorization: `Bearer ${token}` };
  const upload = (body: FormData) => t.fetch("/shortcut/upload", { method: "POST", headers, body });
  return { t, owner, headers, upload };
}

const form = (fields: Record<string, string> = {}, images = 1) => {
  const body = new FormData();
  for (let i = 0; i < images; i++) {
    body.append("image", new Blob([new Uint8Array(32)], { type: "image/jpeg" }), `screen${i}.jpg`);
  }
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  return body;
};

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("shortcut endpoint", () => {
  test("infers the week from the target when the Shortcut sends none", async () => {
    const { owner, upload } = await setup();
    for (const target of ["game_box_score", "weekly_awards", "standings"]) await upload(form({ target }));
    const sets = await owner.query(api.ingestion.inbox.list, {});
    const week = (target: string) => sets.find((s) => s.targetKey === target)?.weekKey ?? null;
    // The sample season's latest result is week 6.
    expect([week("game_box_score"), week("weekly_awards"), week("standings")]).toEqual(["w7", "w6", null]);
  });

  test("refuses a missing or revoked token and accepts a valid one", async () => {
    const { t, owner, headers, upload } = await setup();
    expect((await t.fetch("/shortcut/upload", { method: "POST", body: form() })).status).toBe(401);

    const menu = await t.fetch("/shortcut/targets", { headers });
    const body = (await menu.json()) as { targetLabels: string[] };
    expect(body).toMatchObject({
      season: SAMPLE_START_YEAR,
      suggestedWeek: "Week 7",
      targetByLabel: { "Box score": "game_box_score", Standings: "standings" },
      weekByLabel: { "Week 1": "w1" },
      asksWeekByLabel: { "Box score": true, "Weekly awards": true, Standings: false },
    });
    expect(body.targetLabels.slice(0, 3)).toEqual(["Full game log", "Box score", "Team game stats"]);
    expect((await upload(form({ target: "nonsense", week: "w1" }))).status).toBe(400);
    const ok = await upload(form({ week: "w1" }));
    expect(await ok.json()).toMatchObject({ ok: true, images: 1 });
    const [set] = await owner.query(api.ingestion.inbox.list, {});
    expect(set).toMatchObject({ status: "queued", weekKey: "w1", year: SAMPLE_START_YEAR });

    const [listed] = await owner.query(api.ingestion.tokens.list, {});
    expect(listed?.lastUsedAt).not.toBeNull();
    await owner.mutation(api.ingestion.tokens.revoke, { tokenId: listed!._id });
    expect((await t.fetch("/shortcut/targets", { headers })).status).toBe(401);
  });
});

describe("shortcut batches", () => {
  const boxScore = { target: "game_box_score", week: "w1", batch: "b1", batchSize: "3" };

  test("one image per request lands in one set that is read once the batch is complete", async () => {
    const { t, owner, upload } = await setup();
    await upload(form(boxScore));
    await upload(form(boxScore));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await owner.query(api.ingestion.inbox.list, {})).toMatchObject([
      { setKey: "batch:b1", status: "queued", images: [{}, {}] },
    ]);

    expect(await (await upload(form(boxScore))).json()).toMatchObject({ ok: true, sets: 1, images: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await owner.query(api.ingestion.inbox.list, {})).toMatchObject([
      { setKey: "batch:b1", status: "review", images: [{}, {}, {}] },
    ]);
  });

  test("refuses bad batch fields, extra screenshots and a resend once read", async () => {
    const { t, owner, upload } = await setup();
    for (const bad of [{ batch: "" }, { batch: "b 1" }, { batchSize: "21" }, { batchSize: "two" }]) {
      expect((await upload(form({ ...boxScore, ...bad }))).status).toBe(400);
    }
    expect((await upload(form({ ...boxScore, batchSize: "1" }, 2))).status).toBe(400);
    expect((await upload(form({ ...boxScore, batchSize: "1" }))).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const resend = await upload(form({ ...boxScore, batchSize: "1" }));
    expect(resend.status).toBe(400);
    expect(await resend.json()).toMatchObject({ error: expect.stringMatching(/already read/) });
    expect(await owner.query(api.ingestion.inbox.list, {})).toHaveLength(1);
  });

  test("screens read one by one stay a set each in a batch", async () => {
    const { owner, upload } = await setup();
    const card = { target: "team_game_stats", week: "w1", batch: "b2", batchSize: "2" };
    await upload(form(card));
    await upload(form(card));
    const sets = await owner.query(api.ingestion.inbox.list, {});
    expect(sets.map((s) => s.setKey)).not.toContain("batch:b2");
    expect(sets).toHaveLength(2);
  });
});

describe("rate limits", () => {
  test("valid requests are rate limited, and junk tokens never lock out the owner", async () => {
    const { t, headers } = await setup();
    const junk = { Authorization: "Bearer ft_guess" };

    const junkStatuses = [];
    for (let i = 0; i < 22; i++)
      junkStatuses.push((await t.fetch("/shortcut/targets", { headers: junk })).status);
    expect(junkStatuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(junkStatuses.slice(20)).toEqual([429, 429]);

    const statuses = [];
    for (let i = 0; i < 20; i++) statuses.push((await t.fetch("/shortcut/targets", { headers })).status);
    expect(statuses.every((s) => s === 200)).toBe(true);
    const limited = await t.fetch("/shortcut/targets", { headers });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

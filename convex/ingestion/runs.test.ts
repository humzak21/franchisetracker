/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";
import { fixtureAnswer } from "./fixture";

const modules = import.meta.glob("/convex/**/*.ts");

/** A box score set uploaded with full context, so it is extracting with its run not yet started. */
async function setup(screenshots = 2) {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const seasonId = active.seasons.find((s) => s.year === SAMPLE_START_YEAR + 1)!._id;
  const image = () =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(64)], { type: "image/png" })));
  const [setKey] = await owner.mutation(api.ingestion.uploads.create, {
    storageIds: await Promise.all(Array.from({ length: screenshots }, image)),
    source: "web",
    targetKey: "game_box_score",
    seasonId,
    weekKey: "w1",
  });
  const runAll = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, owner, setKey: setKey!, runAll };
}

type Request = {
  model: string;
  messages: { content: string | { type: string; image_url?: { url: string } }[] }[];
};

/** Answers every OpenRouter call with the box score fixture, recording the models and images sent. */
function stubOpenRouter() {
  process.env.OPENROUTER_API_KEY = "test-key";
  const calls: string[] = [];
  const images: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Request;
    calls.push(body.model);
    for (const message of body.messages)
      if (typeof message.content !== "string")
        for (const part of message.content) if (part.image_url) images.push(part.image_url.url);
    const answer = fixtureAnswer("game_box_score", { home: "NE", away: "BUF", userIsHome: true });
    return Response.json({ model: body.model, choices: [{ message: { content: JSON.stringify(answer) } }] });
  });
  return { calls, images };
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.AUTH_TEST_MODE;
  delete process.env.OPENROUTER_API_KEY;
});

describe("extraction runs", () => {
  test("a stopped set stays stopped when its run answers late", async () => {
    const { owner, setKey, runAll } = await setup();
    const reading = await owner.query(api.ingestion.review.get, { setKey });
    expect(reading).toMatchObject({ status: "extracting", extractionStartedAt: expect.any(Number) });

    await owner.mutation(api.ingestion.uploads.stop, { setKeys: [setKey] });
    await runAll();
    expect(await owner.query(api.ingestion.review.get, { setKey })).toMatchObject({
      status: "failed",
      error: expect.stringMatching(/Stopped/),
      extractionStartedAt: null,
      extraction: null,
    });
  });

  test("restarting drops the old run before it calls a model", async () => {
    const { calls } = stubOpenRouter();
    const { owner, setKey, runAll } = await setup();
    vi.setSystemTime(Date.now() + 1000);
    await owner.mutation(api.ingestion.uploads.extract, { setKey, model: "vendor/other-model" });
    await runAll();
    expect(calls).toEqual(["vendor/other-model"]);
    const review = await owner.query(api.ingestion.review.get, { setKey });
    expect(review).toMatchObject({ status: "review", extraction: { model: "vendor/other-model" } });
  });

  test("screenshots go to the model as links on a cloud deployment, not inline in the request", async () => {
    const { images } = stubOpenRouter();
    const { runAll } = await setup();
    await runAll();
    expect(images).toHaveLength(2);
    for (const url of images) expect(url).toMatch(/^https:\/\//);
  });

  test("a big box score is read a few screenshots per request and merged into one draft", async () => {
    const { calls, images } = stubOpenRouter();
    const single = await setup();
    await single.runAll();
    const one = await single.owner.query(api.ingestion.review.get, { setKey: single.setKey });
    calls.length = 0;
    images.length = 0;

    const { owner, setKey, runAll } = await setup(8);
    await runAll();
    expect(calls).toHaveLength(3);
    expect(images).toHaveLength(8);
    const merged = await owner.query(api.ingestion.review.get, { setKey });
    expect(merged.status).toBe("review");
    // Every chunk answered the same box score, so the merge is that one box score again.
    expect(merged.extraction?.draft).toEqual(one.extraction?.draft);
  });

  test("the watchdog fails a run that never reported back, and the set can be read again", async () => {
    const { t, owner, setKey, runAll } = await setup();
    // Convex stopping the action mid-call looks like this: the run is over and nothing was saved.
    await t.run(async (ctx) => {
      const runs = await ctx.db.system.query("_scheduled_functions").take(10);
      for (const run of runs) if (run.name.includes("extract")) await ctx.scheduler.cancel(run._id);
    });
    await runAll();
    expect(await owner.query(api.ingestion.review.get, { setKey })).toMatchObject({
      status: "failed",
      error: expect.stringMatching(/Timed out/),
    });

    await owner.mutation(api.ingestion.uploads.extract, { setKey });
    await runAll();
    expect(await owner.query(api.ingestion.review.get, { setKey })).toMatchObject({ status: "review" });
  });

  test("strangers cannot stop a set", async () => {
    const { t, setKey } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.mutation(api.ingestion.uploads.stop, { setKeys: [setKey] })).rejects.toThrow(
      /Not the owner/,
    );
  });
});

describe("model presets", () => {
  test("saved models join the presets, defaults first, and can be removed", async () => {
    const { owner } = await setup();
    const presets = async () => (await owner.query(api.ingestion.settings.get, {})).presets;
    expect(await presets()).toEqual([
      { model: "google/gemini-4-argon", saved: false },
      { model: "anthropic/claude-sonnet-5.5", saved: false },
    ]);

    await owner.mutation(api.ingestion.settings.addPreset, { model: " openai/gpt-6-vision " });
    await owner.mutation(api.ingestion.settings.setModels, {
      primary: "x-ai/grok-5:beta",
      fallback: "google/gemini-4-argon",
    });
    expect(await presets()).toEqual([
      { model: "google/gemini-4-argon", saved: false },
      { model: "anthropic/claude-sonnet-5.5", saved: false },
      { model: "openai/gpt-6-vision", saved: true },
      { model: "x-ai/grok-5:beta", saved: true },
    ]);

    await owner.mutation(api.ingestion.settings.removePreset, { model: "openai/gpt-6-vision" });
    // The primary in use stays offered after its preset is removed.
    await owner.mutation(api.ingestion.settings.removePreset, { model: "x-ai/grok-5:beta" });
    expect((await presets()).map((p) => p.model)).toEqual([
      "google/gemini-4-argon",
      "anthropic/claude-sonnet-5.5",
      "x-ai/grok-5:beta",
    ]);
  });

  test("a model id that is not vendor/model is refused", async () => {
    const { owner } = await setup();
    await expect(owner.mutation(api.ingestion.settings.addPreset, { model: "gpt" })).rejects.toThrow(
      /vendor\/model/,
    );
  });
});

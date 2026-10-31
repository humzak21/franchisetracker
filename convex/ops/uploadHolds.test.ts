import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BUDGET_HELD, DUPLICATE_HELD, usageMonth } from "../../shared/ingestion/budget";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { setup } from "./operations.setup";

beforeEach(() => {
  vi.useFakeTimers();
  process.env.AUTH_TEST_MODE = "true";
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_TEST_MODE;
});

describe("the same screenshot twice", () => {
  test("waits in the inbox instead of being read, until the owner says otherwise", async () => {
    const { owner, send, set, finish } = await setup();
    const first = await send("abc");
    expect((await set(first))?.status).toBe("extracting");
    await finish();

    const again = await send("abc");
    expect(await set(again)).toMatchObject({ status: "queued", hold: "duplicate", error: DUPLICATE_HELD });

    await owner.mutation(api.ingestion.uploads.extract, { setKey: again });
    expect(await set(again)).toMatchObject({ status: "extracting", hold: null, error: null });
    await finish();
  });

  test("a different image, or one rejected earlier, goes straight through", async () => {
    const { owner, send, set, finish } = await setup();
    const first = await send("abc");
    await finish();
    expect((await set(await send("def")))?.hold).toBeNull();
    await finish();
    await owner.mutation(api.ingestion.uploads.reject, { setKeys: [first] });
    expect((await set(await send("abc")))?.hold).toBeNull();
    await finish();
  });

  test("a repeat inside a set holds the whole set", async () => {
    const { owner, context, image, set, finish } = await setup();
    const [key] = await owner.mutation(api.ingestion.uploads.create, {
      storageIds: [await image(), await image()],
      hashes: ["same", "same"],
      ...context,
    });
    expect((await set(key!))?.hold).toBe("duplicate");
    await finish();
  });

  test("uploads with no hash are never held", async () => {
    const { owner, context, image, set, finish } = await setup();
    for (let i = 0; i < 2; i++) {
      const [key] = await owner.mutation(api.ingestion.uploads.create, {
        storageIds: [await image()],
        ...context,
      });
      expect((await set(key!))?.hold).toBeNull();
      await finish();
    }
  });
});

describe("the extraction budget", () => {
  const spend = (t: Awaited<ReturnType<typeof setup>>["t"], franchiseId: Id<"franchises">, costUsd: number) =>
    t.run(async (ctx) => {
      const month = usageMonth(Date.now());
      await ctx.db.insert("usageMonths", { franchiseId, month, costUsd, extractions: 1 });
    });

  test("warns at 80 percent and stops at the limit, holding what comes in", async () => {
    const { t, owner, franchiseId, send, set, finish } = await setup();
    await owner.mutation(api.ingestion.budget.set, { budgetUsd: 10 });
    await spend(t, franchiseId, 8);
    expect(await owner.query(api.ingestion.budget.status, {})).toMatchObject({ level: "warn", spentUsd: 8 });
    expect((await set(await send("one")))?.status).toBe("extracting");
    await finish();

    await owner.mutation(api.ingestion.budget.set, { budgetUsd: 8 });
    const held = await send("two");
    expect(await set(held)).toMatchObject({ status: "queued", hold: "budget", error: BUDGET_HELD });
    expect((await owner.query(api.ingestion.budget.status, {})).level).toBe("over");
    await finish();
    expect((await set(held))?.status).toBe("queued");
  });

  test("a higher budget starts what was held", async () => {
    const { t, owner, franchiseId, send, set, finish } = await setup();
    await owner.mutation(api.ingestion.budget.set, { budgetUsd: 1 });
    await spend(t, franchiseId, 2);
    const held = await send("one");
    await owner.mutation(api.ingestion.budget.set, { budgetUsd: 5 });
    expect((await set(held))?.status).toBe("extracting");
    await finish();
  });

  test("a new month starts it too, from the nightly look", async () => {
    const { t, owner, franchiseId, send, set, finish } = await setup();
    await owner.mutation(api.ingestion.budget.set, { budgetUsd: 1 });
    await spend(t, franchiseId, 2);
    const held = await send("one");
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("usageMonths").take(5);
      for (const row of rows) await ctx.db.delete("usageMonths", row._id);
    });
    await t.mutation(internal.ops.retention.nightly, {});
    await finish();
    expect((await set(held))?.status).toBe("review");
  });

  test("a finished read adds to the month", async () => {
    const { t, owner, franchiseId } = await setup();
    await t.run(async (ctx) => {
      const { addUsage } = await import("../lib/usage");
      await addUsage(ctx, franchiseId, 0.25);
      await addUsage(ctx, franchiseId, 0.5);
      await addUsage(ctx, franchiseId);
    });
    expect((await owner.query(api.ingestion.budget.status, {})).spentUsd).toBe(0.75);
  });

  test("no budget means no limit, and a nonsense one is refused", async () => {
    const { t, owner, franchiseId, send, set, finish } = await setup();
    await spend(t, franchiseId, 1000);
    expect((await set(await send("one")))?.status).toBe("extracting");
    await finish();
    await expect(owner.mutation(api.ingestion.budget.set, { budgetUsd: -1 })).rejects.toThrow(/above zero/);
  });
});

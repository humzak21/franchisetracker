/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

describe("ops/errors", () => {
  test("repeats of one error count up on one row; clearing empties the list", async () => {
    const t = convexTest(schema, modules);
    const owner = await asOwner(t);
    const report = (message: string, line: number) =>
      owner.mutation(api.ops.errors.report, {
        kind: "error",
        message,
        stack: `TypeError: ${message}\n    at Row (http://x/assets/index.js:${line}:9)`,
        path: "/schedule",
      });
    await report("Cannot read 'year' of undefined", 10);
    await report("Cannot read 'year' of undefined", 99);
    await report("Something else", 3);
    const reports = await owner.query(api.ops.errors.recent, {});
    expect(reports.map((r) => [r.message, r.count])).toEqual([
      ["Something else", 1],
      ["Cannot read 'year' of undefined", 2],
    ]);
    await owner.mutation(api.ops.errors.clear, {});
    expect(await owner.query(api.ops.errors.recent, {})).toEqual([]);
  });

  test("only the owner reports or reads errors", async () => {
    const t = convexTest(schema, modules);
    const stranger = await asStranger(t);
    await expect(stranger.query(api.ops.errors.recent, {})).rejects.toThrow(/Not the owner/);
    await expect(
      t.mutation(api.ops.errors.report, { kind: "error", message: "x", path: "/" }),
    ).rejects.toThrow(/Sign in required/);
  });
});

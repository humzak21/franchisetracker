/// <reference types="vite/client" />
import { authTables } from "@convex-dev/auth/server";
import { convexTest } from "convex-test";
import { gunzipSync, strFromU8 } from "fflate";
import { describe, expect, test } from "vitest";
import { BACKUP_TABLES, NOT_BACKED_UP } from "../../shared/ops/backup";
import { parseBackup, restoreBackup } from "../../shared/ops/restore";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_FRANCHISE_NAME } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  return { t, owner: await asOwner(t) };
}

describe("backup coverage", () => {
  test("every table is backed up or left out on purpose", () => {
    const covered = new Set<string>([
      ...BACKUP_TABLES,
      ...Object.keys(NOT_BACKED_UP),
      ...Object.keys(authTables),
    ]);
    const tables = Object.keys(schema.tables);
    expect(tables.filter((t) => !covered.has(t))).toEqual([]);
    expect([...covered].filter((t) => !tables.includes(t))).toEqual([]);
  });
});

describe("after a restore", () => {
  test("the restored franchise rebuilds its boards from its logs", async () => {
    const { t, owner } = await setup();
    await t.finishAllScheduledFunctions(() => undefined);
    const backupId = await owner.action(api.ops.backupRun.create, {});
    const buffer = await t.run(async (ctx) => {
      const backup = (await ctx.db.get("backups", backupId))!;
      const blob = (await ctx.storage.get(backup.storageId))!;
      return await blob.arrayBuffer();
    });
    const file = parseBackup(JSON.parse(strFromU8(gunzipSync(new Uint8Array(buffer)))));
    const { franchiseIds } = await restoreBackup(
      file,
      {
        teams: () => owner.query(api.ops.restoreData.teams, {}),
        insert: (table, rows) => owner.mutation(api.ops.restoreData.insertRows, { table, rows }),
        patch: async (table, patches) => {
          await owner.mutation(api.ops.restoreData.patchRows, { table, patches });
        },
      },
      "restored",
    );
    expect(franchiseIds).toHaveLength(file.tables.franchises.length);
    const restored = franchiseIds[0] as Id<"franchises">;
    const boards = (table: "recordBoards" | "spanBoards" | "teamRecords") =>
      t.run(
        async (ctx) => (await ctx.db.query(table).collect()).filter((b) => b.franchiseId === restored).length,
      );
    expect(await boards("spanBoards")).toBe(0);

    await owner.mutation(api.ops.restoreData.rebuild, { franchiseIds: franchiseIds as Id<"franchises">[] });
    await t.finishAllScheduledFunctions(() => undefined);
    expect(await boards("recordBoards")).toBeGreaterThan(0);
    expect(await boards("spanBoards")).toBeGreaterThan(0);
    expect(await boards("teamRecords")).toBeGreaterThan(0);
  }, 180_000);
});

describe("backup and restore", () => {
  test("a backup restores as a new franchise with the same data, pointing at its own rows", async () => {
    const { t, owner } = await setup();
    const backupId = await owner.action(api.ops.backupRun.create, {});
    const [listed] = await owner.query(api.ops.backupData.list, {});
    expect(listed).toMatchObject({
      _id: backupId,
      kind: "manual",
      franchises: [SAMPLE_FRANCHISE_NAME, "Sample Dynasty"],
    });
    expect(listed!.url).toBeTruthy();

    // An ArrayBuffer crosses t.run as Convex bytes; a Uint8Array does not.
    const buffer = await t.run(async (ctx) => {
      const backup = (await ctx.db.get("backups", backupId))!;
      return await (await ctx.storage.get(backup.storageId))!.arrayBuffer();
    });
    const bytes = new Uint8Array(buffer);
    const file = parseBackup(JSON.parse(strFromU8(gunzipSync(bytes))));
    const result = await restoreBackup(
      file,
      {
        teams: () => owner.query(api.ops.restoreData.teams, {}),
        insert: (table, rows) => owner.mutation(api.ops.restoreData.insertRows, { table, rows }),
        patch: async (table, patches) => {
          await owner.mutation(api.ops.restoreData.patchRows, { table, patches });
        },
      },
      "restored",
    );
    expect(result.franchises).toEqual([`${SAMPLE_FRANCHISE_NAME} (restored)`, "Sample Dynasty (restored)"]);
    expect(result.rows).toBeGreaterThan(100);

    // The original is untouched and still active; the copy is a separate, inactive franchise.
    const list = await owner.query(api.franchise.franchises.list, {});
    expect(list.filter((f) => f.isActive).map((f) => f.name)).toEqual([SAMPLE_FRANCHISE_NAME]);
    const copy = list.find((f) => f.name === `${SAMPLE_FRANCHISE_NAME} (restored)`)!;
    const before = await owner.query(api.games.directory.all, {});
    await owner.mutation(api.franchise.franchises.activate, { franchiseId: copy._id });
    const after = await owner.query(api.games.directory.all, {});
    expect(after.map((g) => [g.year, g.weekKey, g.opponentAbbr, g.us])).toEqual(
      before.map((g) => [g.year, g.weekKey, g.opponentAbbr, g.us]),
    );
    expect(after.map((g) => g._id)).not.toEqual(before.map((g) => g._id));

    // Every reference in the copy points at the copy's own rows.
    const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
    const leaks = await t.run(async (ctx) => {
      const lines = await ctx.db.query("gameStatLines").take(1000);
      const mine = lines.filter((l) => l.franchiseId === active.franchise._id);
      const wrong = [];
      for (const line of mine) {
        const [game, player] = await Promise.all([
          ctx.db.get("games", line.gameId),
          ctx.db.get("players", line.playerId as Id<"players">),
        ]);
        if (
          game?.franchiseId !== active.franchise._id ||
          (player && player.franchiseId !== active.franchise._id)
        ) {
          wrong.push(line._id);
        }
      }
      return { lines: mine.length, wrong };
    });
    expect(leaks.lines).toBeGreaterThan(0);
    expect(leaks.wrong).toEqual([]);
    const home = await owner.query(api.dashboard.home.season, {
      seasonId: active.seasons.find((s) => s.year === 2026)!._id,
    });
    expect(home?.summary.regular).toEqual({ w: 4, l: 1, t: 0 });
  });

  test("scheduled backups keep the latest fourteen", async () => {
    const { t, owner } = await setup();
    for (let i = 0; i < 16; i++) await t.action(internal.ops.backupRun.nightly, {});
    const list = await owner.query(api.ops.backupData.list, {});
    expect(list.filter((b) => b.kind === "scheduled")).toHaveLength(14);
  });

  test("only the owner backs up, lists or restores", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(stranger.action(api.ops.backupRun.create, {})).rejects.toThrow(/Not the owner/);
    await expect(stranger.query(api.ops.backupData.list, {})).rejects.toThrow(/Not the owner/);
    await expect(
      stranger.mutation(api.ops.restoreData.insertRows, { table: "seasons", rows: [] }),
    ).rejects.toThrow(/Not the owner/);
  });
});

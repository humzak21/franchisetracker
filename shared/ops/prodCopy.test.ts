import { describe, expect, test } from "vitest";
import { BACKUP_TABLES, NOT_BACKED_UP } from "./backup";
import {
  SCRUBBED_TABLES,
  copyPorts,
  dropStorageRows,
  findLeaks,
  keptTables,
  settleDocuments,
  storageIds,
} from "./prodCopy";

const jsonl = (...rows: unknown[]) => rows.map((row) => `${JSON.stringify(row)}\n`).join("");

describe("keptTables", () => {
  test("keeps franchise data and never a scrubbed table", () => {
    const kept = keptTables([...BACKUP_TABLES, ...Object.keys(NOT_BACKED_UP), "users", "authSessions"]);
    expect(kept.has("franchises")).toBe(true);
    expect(kept.has("uploads")).toBe(true);
    expect(kept.has("teams")).toBe(true);
    for (const table of Object.keys(SCRUBBED_TABLES)) expect(kept.has(table)).toBe(false);
  });
});

describe("settleDocuments", () => {
  test("fails a running import and leaves a finished one alone", () => {
    const done = { _id: "b", status: "done" };
    const settled = settleDocuments("historyImports", jsonl({ _id: "a", status: "running" }, done)).split(
      "\n",
    );
    expect(JSON.parse(settled[0] ?? "")).toMatchObject({ _id: "a", status: "failed" });
    expect(settled[1]).toBe(JSON.stringify(done));
  });

  test("fails an upload caught extracting and forgets its run", () => {
    const row = { _id: "a", status: "extracting", extractionStartedAt: 5.5 };
    const settled = JSON.parse(settleDocuments("uploads", jsonl(row))) as Record<string, unknown>;
    expect(settled).toMatchObject({ status: "failed" });
    expect(settled).not.toHaveProperty("extractionStartedAt");
  });

  test("drops a running records build so the app offers a new one", () => {
    const done = { _id: "b", status: "done" };
    expect(settleDocuments("recordBuilds", jsonl({ _id: "a", status: "running" }, done))).toBe(jsonl(done));
  });

  test("keeps every number's text on a rewritten row", () => {
    const line = '{"_id":"a","counts":{"players":0.0},"startedAt":1793377536356.16,"status":"running"}\n';
    const settled = settleDocuments("historyImports", line);
    expect(settled).toContain('"players":0.0');
    expect(settled).toContain('"startedAt":1793377536356.16');
  });

  test("passes other tables through byte for byte", () => {
    const text = '{"_id":"a","status":"running","n":0.0}\n';
    expect(settleDocuments("players", text)).toBe(text);
  });
});

describe("storage rows", () => {
  test("reads the files a table points at and drops exactly those", () => {
    const backups = jsonl({ _id: "x", storageId: "file1" }, { _id: "y", storageId: "file2" });
    const ids = storageIds(backups);
    expect(ids).toEqual(["file1", "file2"]);
    const stored = '{"_id":"file1","size":1.0}\n{"_id":"file3","size":2.0}\n';
    expect(dropStorageRows(stored, new Set(ids))).toBe('{"_id":"file3","size":2.0}\n');
  });
});

describe("findLeaks", () => {
  test.each([
    ["https://glad-otter-123.convex.cloud/api", "a Convex deployment URL"],
    ["https://glad-otter-123.convex.site/x", "a Convex deployment URL"],
    ["https://franchisetracker.vercel.app", "a Vercel URL"],
    ["owner@example.com", "an email address"],
    ["sk-or-v1-abcdef0123456789", "an API key or bearer token"],
    ["Bearer abcdefghijklmnop0123", "an API key or bearer token"],
    ["eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2ln", "a signed token"],
  ])("finds %s", (text, label) => {
    expect(findLeaks(`{"note":"${text}"}`)).toContain(label);
  });

  test("passes ordinary rows", () => {
    expect(
      findLeaks('{"name":"Patrick Mahomes","espnId":3139477,"logo":"https://a.espncdn.com/x.png"}'),
    ).toEqual([]);
  });
});

describe("copyPorts", () => {
  const taken = [3210, 3211, 3299, 5173, 5174];

  test("is stable for a checkout and differs between checkouts", () => {
    expect(copyPorts("/a/one")).toEqual(copyPorts("/a/one"));
    expect(copyPorts("/a/one")).not.toEqual(copyPorts("/a/two"));
  });

  test("never lands on a port Playwright or npm run dev uses", () => {
    for (let i = 0; i < 5000; i++) {
      const { cloud, site, web } = copyPorts(`/worktrees/checkout-${i}`);
      expect(site).toBe(cloud + 1);
      expect(web).toBe(cloud + 2);
      for (const port of [cloud, site, web]) {
        expect(taken).not.toContain(port);
        expect(port).toBeGreaterThanOrEqual(3310);
        expect(port).toBeLessThan(4310);
      }
    }
  });
});

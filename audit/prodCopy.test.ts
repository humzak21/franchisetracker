/**
 * Static audits of the production copy (docs/PROD-COPY.md): production is only ever read, the
 * copy's commands can only reach the copy, and Playwright cannot end up running on it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PROD_COPY_INSTANCE, copyPorts } from "../shared/ops/prodCopy";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const scripts = readdirSync(join(ROOT, "scripts/prod-copy")).map((name) => ({
  name,
  text: read(`scripts/prod-copy/${name}`),
}));

describe("production is only read", () => {
  test("the one command that names production is an export", () => {
    const prod = scripts.filter(({ text }) => text.includes('"--prod"'));
    expect(prod.map(({ name }) => name)).toEqual(["snapshot.mjs"]);
    expect(prod[0]?.text.match(/"--prod"/g)).toHaveLength(1);
    expect(prod[0]?.text).toContain('["export", "--prod"');
  });

  test("nothing deploys", () => {
    for (const { text } of scripts) expect(text).not.toMatch(/["']deploy["']/);
  });

  test("the raw export is deleted however the snapshot ends", () => {
    const snapshot = scripts.find(({ name }) => name === "snapshot.mjs")?.text ?? "";
    expect(snapshot).toMatch(/finally \{\s+rmSync\(incoming/);
  });
});

describe("the copy's commands only reach the copy", () => {
  test("every Convex CLI call goes through the copy's own env file", () => {
    for (const name of ["use.mjs", "dev.mjs"]) {
      const text = scripts.find((script) => script.name === name)?.text ?? "";
      const calls = [...text.matchAll(/convex\("(\w+)"[^\n]*/g), ...text.matchAll(/spawn\(convexBin[^\n]*/g)];
      for (const [call] of calls) expect(call).toContain("copyEnvFile");
    }
  });

  test("no shell selection carries over, and the backend stays on loopback behind the gate", () => {
    const lib = scripts.find(({ name }) => name === "lib.mjs")?.text ?? "";
    expect(lib).toContain('!name.startsWith("CONVEX_")');
    expect(lib).toMatch(/"--interface",\s+"127\.0\.0\.1"/);
    expect(lib).toContain('"--convex-http-proxy"');
  });
});

describe("Playwright stays on sample data", () => {
  test("the e2e build always talks to port 3210", () => {
    expect(read(".env.e2e")).toMatch(/^VITE_CONVEX_URL=http:\/\/127\.0\.0\.1:3210$/m);
  });

  test("a copy never takes that port, whatever the checkout", () => {
    expect(Object.values(copyPorts(ROOT))).not.toContain(3210);
  });

  test("the e2e backend refuses a copy before it writes anything", () => {
    const text = read("scripts/e2e-backend.mjs");
    expect(text).toContain("instance === PROD_COPY_INSTANCE");
    const [guard, setup] = [text.indexOf("PROD_COPY_INSTANCE) {"), text.indexOf('run("node"')];
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(setup);
    expect(PROD_COPY_INSTANCE).not.toBe("anonymous-agent");
  });

  test("the copy's env file for Vite is ignored by git", () => {
    expect(read(".gitignore")).toContain(".env.*.local");
    expect(read(".gitignore")).toContain(".convex/");
  });
});

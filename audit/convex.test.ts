/**
 * Static audits of the Convex functions (CLAUDE.md, "Convex"): every public function checks the
 * owner and validates its arguments, the HTTP endpoints check their token and rate limit, and no
 * query scans with `.filter` or reads a table whole with `.collect()`. Reads the source, so a new
 * file is covered the moment it exists.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = join(__dirname, "..", "convex");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "_generated" ? [] : sources(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}

type Fn = { file: string; name: string; kind: string; body: string };

/** Every `export const name = kind(...)`, with its source up to the next export. */
function exportedFunctions(): Fn[] {
  return sources(ROOT).flatMap((path) => {
    const text = readFileSync(path, "utf8");
    const file = relative(ROOT, path).replace(/\.ts$/, "");
    const starts = [...text.matchAll(/^export const (\w+) = (\w+)\(/gm)];
    return starts.map((match, i) => ({
      file,
      name: match[1]!,
      kind: match[2]!,
      body: text.slice(match.index, starts[i + 1]?.index ?? text.length),
    }));
  });
}

const FUNCTIONS = exportedFunctions();
const ref = (f: Fn) => `${f.file}:${f.name}`;

/** Public on purpose: the sign-in screen asks which sign-in buttons to show. */
const UNAUTHENTICATED = new Set(["account:authInfo"]);

describe("authorization", () => {
  test("finds the functions it audits", () => {
    expect(FUNCTIONS.filter((f) => f.kind === "query").length).toBeGreaterThan(40);
    expect(FUNCTIONS.some((f) => f.kind === "httpAction")).toBe(true);
  });

  test("every public query and mutation checks the owner", () => {
    const missing = FUNCTIONS.filter(
      (f) => (f.kind === "query" || f.kind === "mutation") && !UNAUTHENTICATED.has(ref(f)),
    )
      .filter((f) => !/requireOwner\(ctx\)/.test(f.body))
      .map(ref);
    expect(missing).toEqual([]);
  });

  test("every public action checks the owner", () => {
    const missing = FUNCTIONS.filter(
      (f) => f.kind === "action" && !/requireOwnerAction\(ctx\)/.test(f.body),
    ).map(ref);
    expect(missing).toEqual([]);
  });

  test("every HTTP endpoint checks its token and rate limit", () => {
    const http = FUNCTIONS.filter((f) => f.kind === "httpAction");
    expect(http.filter((f) => !/await guard\(ctx, request\)/.test(f.body)).map(ref)).toEqual([]);
  });

  test("every function validates its arguments", () => {
    const missing = FUNCTIONS.filter(
      (f) => /^(internal)?([Qq]uery|[Mm]utation|[Aa]ction)$/.test(f.kind) && !/\bargs:/.test(f.body),
    ).map(ref);
    expect(missing).toEqual([]);
  });
});

describe("reads", () => {
  const files = sources(ROOT).map((path) => ({
    file: relative(ROOT, path),
    text: readFileSync(path, "utf8"),
  }));

  test("no query reads a whole table with .collect()", () => {
    expect(files.filter((f) => /\.collect\(\)/.test(f.text)).map((f) => f.file)).toEqual([]);
  });

  test("no query filters a scan instead of using an index", () => {
    // Convex's query filter takes the `q` builder; array filters in the same files take other names.
    expect(files.filter((f) => /\.filter\(\s*\(?q\)?\s*=>/.test(f.text)).map((f) => f.file)).toEqual([]);
  });
});

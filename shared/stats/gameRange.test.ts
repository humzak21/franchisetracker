import { describe, expect, it } from "vitest";
import { inRange, seasonsIn } from "./gameRange";

const points = [
  { key: "a", year: 2026 },
  { key: "b", year: 2026 },
  { key: "c", year: 2027 },
  { key: "d", year: 2027 },
  { key: "e", year: 2028 },
];
const keys = (list: readonly { key: string }[]) => list.map((p) => p.key).join("");

describe("inRange", () => {
  it("keeps every game for all", () => {
    expect(keys(inRange(points, { kind: "all" }))).toBe("abcde");
  });

  it("keeps one season", () => {
    expect(keys(inRange(points, { kind: "season", year: 2027 }))).toBe("cd");
    expect(inRange(points, { kind: "season", year: 2030 })).toEqual([]);
  });

  it("spans across seasons, both ends included, either way round", () => {
    expect(keys(inRange(points, { kind: "span", from: "b", to: "d" }))).toBe("bcd");
    expect(keys(inRange(points, { kind: "span", from: "d", to: "b" }))).toBe("bcd");
    expect(keys(inRange(points, { kind: "span", from: "c", to: "c" }))).toBe("c");
  });

  it("opens a span whose end is gone to the first or last game", () => {
    expect(keys(inRange(points, { kind: "span", from: "x", to: "b" }))).toBe("ab");
    expect(keys(inRange(points, { kind: "span", from: "d", to: "x" }))).toBe("de");
  });
});

describe("seasonsIn", () => {
  it("lists each season once, newest first", () => {
    expect(seasonsIn(points)).toEqual([2028, 2027, 2026]);
  });
});

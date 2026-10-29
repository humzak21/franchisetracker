import { describe, expect, test } from "vitest";
import { batchActions, fillWeeks, orderBatch, weekStates, type BatchSetLike } from "./batch";

const set = (
  setKey: string,
  status: BatchSetLike["status"],
  weekKey: BatchSetLike["weekKey"] = null,
  ready = false,
) => ({
  setKey,
  status,
  weekKey,
  ready,
});

describe("weekly awards batch", () => {
  const sets = [
    set("done5", "committed", "w5"),
    set("a", "queued"),
    set("b", "review", "w2", true),
    set("c", "queued"),
    set("done1", "committed", "w1"),
  ];

  test("open sets in upload order, committed ones by week", () => {
    expect(orderBatch(sets).map((s) => s.setKey)).toEqual(["a", "b", "c", "done1", "done5"]);
  });

  test("filling weeks skips weeks fully captured or waiting", () => {
    expect(fillWeeks(sets, ["w1", "w3", "w5"])).toEqual([
      { setKey: "a", weekKey: "w4" },
      { setKey: "c", weekKey: "w6" },
    ]);
  });

  test("week states flag a week two screenshots claim", () => {
    const states = weekStates([...sets, set("d", "queued", "w2")], ["w1", "w5"]);
    expect([states.w1, states.w2, states.w3, states.w5]).toEqual(["done", "duplicate", "missing", "done"]);
  });

  test("read what has a week, commit what read cleanly", () => {
    const { toRead, toCommit } = batchActions([...sets, set("e", "failed", "w7"), set("f", "review", "w8")]);
    expect(toRead.map((s) => s.setKey)).toEqual(["e"]);
    expect(toCommit.map((s) => s.setKey)).toEqual(["b"]);
  });
});

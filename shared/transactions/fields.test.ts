import { describe, expect, test } from "vitest";
import { carryOver, diffFields, sameValue, undoPatch, untouchedSince } from "./fields";

describe("roster field changes", () => {
  test("values compare structurally, ignoring key order", () => {
    expect(sameValue({ type: "trade", year: 2026 }, { year: 2026, type: "trade" })).toBe(true);
    expect(sameValue({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
    expect(sameValue(undefined, undefined)).toBe(true);
    expect(sameValue(undefined, null)).toBe(false);
  });

  test("a diff records only the fields that change, with both values", () => {
    const change = diffFields(
      { status: "active", statusWeekKey: "w2", contract: { years: 1 } },
      { status: "released", statusWeekKey: "w2", acquisition: { type: "waiver" } },
    );
    expect(change.changed).toEqual(["status", "acquisition"]);
    expect(change.prev).toEqual({ status: "active", acquisition: undefined });
    expect(change.next).toEqual({ status: "released", acquisition: { type: "waiver" } });
  });

  test("clearing a field is a change", () => {
    const change = diffFields(
      { status: "ir", statusWeekKey: "w5" },
      { status: "active", statusWeekKey: undefined },
    );
    expect(change.changed).toEqual(["status", "statusWeekKey"]);
  });

  test("undo restores fields still holding the move's value and leaves manual edits alone", () => {
    const change = diffFields(
      { status: "active", statusWeekKey: undefined },
      { status: "traded", statusWeekKey: "w6" },
    );
    expect(undoPatch({ status: "traded", statusWeekKey: "w6" }, change)).toEqual({
      status: "active",
      statusWeekKey: undefined,
    });
    // The owner moved the player to IR by hand since: the status stays, the week still goes back.
    expect(undoPatch({ status: "ir", statusWeekKey: "w6" }, change)).toEqual({ statusWeekKey: undefined });
  });

  test("a created entry is removable only while it still holds what the move set", () => {
    const change = diffFields({}, { status: "active", acquisition: { type: "trade", year: 2026 } });
    expect(untouchedSince({ status: "active", acquisition: { year: 2026, type: "trade" } }, change)).toBe(
      true,
    );
    expect(untouchedSince({ status: "released", acquisition: { type: "trade", year: 2026 } }, change)).toBe(
      false,
    );
  });

  test("a new entry carries jersey, position, rating and trait; age and experience only within a season", () => {
    const source = {
      jersey: 87,
      position: "TE" as const,
      ovr: 91,
      devTrait: "xfactor" as const,
      abilities: ["Matchup Nightmare"],
      age: 36,
      exp: 13,
    };
    expect(carryOver(source, true)).toEqual(source);
    expect(carryOver(source, false)).toEqual({ jersey: 87, position: "TE", ovr: 91, devTrait: "xfactor" });
    expect(carryOver({ position: "QB" }, true)).toEqual({ position: "QB" });
  });
});

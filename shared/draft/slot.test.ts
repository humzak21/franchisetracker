import { describe, expect, test } from "vitest";
import { DRAFT_PICKS, overallPick, pickInRound } from "./slot";

describe("draft slots", () => {
  test("a round and the pick in it give the overall pick", () => {
    expect(overallPick(1, 7)).toBe(7);
    expect(overallPick(3, 30)).toBe(94);
    expect(overallPick(4, 32)).toBe(128);
    expect(overallPick(7, 32)).toBe(DRAFT_PICKS);
  });

  test("an overall number printed as the pick is read as itself when it falls in the round", () => {
    expect(overallPick(4, 128)).toBe(128);
    expect(overallPick(4, 97)).toBe(97);
    expect(overallPick(4, 140)).toBeNull();
  });

  test("anything that is not a slot is null", () => {
    expect(overallPick(0, 5)).toBeNull();
    expect(overallPick(8, 5)).toBeNull();
    expect(overallPick(2, 0)).toBeNull();
    expect(overallPick(null, 5)).toBeNull();
    expect(overallPick(2, "5")).toBeNull();
  });

  test("an overall pick gives back the pick within its round", () => {
    expect(pickInRound(1)).toBe(1);
    expect(pickInRound(32)).toBe(32);
    expect(pickInRound(33)).toBe(1);
    expect(pickInRound(128)).toBe(32);
  });
});

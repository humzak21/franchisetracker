import { describe, expect, test } from "vitest";
import { isByeWeekSlate } from "./byeWeek";

describe("isByeWeekSlate", () => {
  test("a regular-season week of 13 to 15 games is a bye week's slate", () => {
    expect(isByeWeekSlate("w7", 13)).toBe(true);
    expect(isByeWeekSlate("w7", 15)).toBe(true);
  });

  test("full and partial weeks say nothing about byes", () => {
    expect(isByeWeekSlate("w7", 16)).toBe(false);
    expect(isByeWeekSlate("w7", 8)).toBe(false);
  });

  test("the preseason and playoffs have no byes to record", () => {
    expect(isByeWeekSlate("pre2", 14)).toBe(false);
    expect(isByeWeekSlate("wc", 6)).toBe(false);
  });
});

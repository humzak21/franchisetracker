import { describe, expect, test } from "vitest";
import { phaseHasWeeks, resolvePhase, sortByTiming, timingError, timingLabel, weeksForPhase } from "./timing";

describe("transaction timing", () => {
  test("only the in-season phases carry weeks", () => {
    expect(phaseHasWeeks("regular")).toBe(true);
    expect(phaseHasWeeks("draft")).toBe(false);
    expect(weeksForPhase("preseason")).toEqual(["pre1", "pre2", "pre3"]);
    expect(weeksForPhase("postseason")).toEqual(["wc", "div", "conf", "sb"]);
    expect(weeksForPhase("regular")).toHaveLength(18);
    expect(weeksForPhase("free_agency")).toEqual([]);
  });

  test("older rows read as their week's phase, or the offseason", () => {
    expect(resolvePhase(undefined, "w7")).toBe("regular");
    expect(resolvePhase(undefined, "probowl")).toBe("postseason");
    expect(resolvePhase(undefined, undefined)).toBe("offseason");
    expect(resolvePhase("draft", undefined)).toBe("draft");
  });

  test("labels name the week when there is one, else the phase", () => {
    expect(timingLabel("regular", "w7")).toBe("Week 7");
    expect(timingLabel("postseason", "wc")).toBe("Wild Card");
    expect(timingLabel("draft", undefined)).toBe("During the draft");
    expect(timingLabel(undefined, undefined)).toBe("Offseason");
  });

  test("moves sort by phase, then week, keeping ties in order", () => {
    const moves = [
      { id: "w3", phase: "regular" as const, weekKey: "w3" as const },
      { id: "draft", phase: "draft" as const },
      { id: "old-w1", weekKey: "w1" as const },
      { id: "fa", phase: "free_agency" as const },
      { id: "pre", phase: "preseason" as const, weekKey: "pre2" as const },
      { id: "old", phase: undefined },
      { id: "fa2", phase: "free_agency" as const },
      { id: "sb", phase: "postseason" as const, weekKey: "sb" as const },
    ];
    expect(sortByTiming(moves).map((m) => m.id)).toEqual([
      "old",
      "fa",
      "fa2",
      "draft",
      "pre",
      "old-w1",
      "w3",
      "sb",
    ]);
  });

  test("a week must match its phase, and offseason moves have none", () => {
    expect(timingError("regular", "w4")).toBeNull();
    expect(timingError("draft", undefined)).toBeNull();
    expect(timingError("regular", undefined)).toMatch(/week/);
    expect(timingError("preseason", "w2")).toMatch(/not in the preseason/);
    expect(timingError("free_agency", "w2")).toMatch(/no week/);
  });
});

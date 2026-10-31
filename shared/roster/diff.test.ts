import { describe, expect, test } from "vitest";
import { rosterDiff } from "./diff";

const row = (
  playerId: string,
  ovr?: number,
  status: "active" | "released" | "traded" | "unsigned" = "active",
) => ({ playerId, ovr, status });

describe("rosterDiff", () => {
  test("arrivals and departures, best first", () => {
    const diff = rosterDiff(
      [row("a", 80), row("b", 90), row("c", 70)],
      [row("c", 70), row("d", 75), row("e", 85)],
    );
    expect(diff.arrivals.map((r) => r.playerId)).toEqual(["e", "d"]);
    expect(diff.departures.map((r) => r.playerId)).toEqual(["b", "a"]);
  });

  test("OVR changes, biggest move first, skipping the unrated and the unchanged", () => {
    const diff = rosterDiff(
      [row("a", 80), row("b", 90), row("c"), row("d", 70)],
      [row("a", 82), row("b", 85), row("c", 75), row("d", 70)],
    );
    expect(diff.changes.map((c) => [c.after.playerId, c.delta])).toEqual([
      ["b", -5],
      ["a", 2],
    ]);
  });

  test("someone who left during a season is not on either roster", () => {
    const diff = rosterDiff([row("a", 80, "released")], [row("a", 80, "traded"), row("b", 70, "unsigned")]);
    expect(diff.departures).toEqual([]);
    expect(diff.arrivals.map((r) => r.playerId)).toEqual(["b"]);
  });
});

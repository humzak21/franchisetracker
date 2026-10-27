import { describe, expect, it } from "vitest";
import { attachableSets } from "./inboxChoices";

describe("attachableSets", () => {
  it("drops committed and extracting sets and puts untagged ones first, newest first", () => {
    const sets = [
      { key: "a", status: "review", targetKey: "game_box_score", createdAt: 5 },
      { key: "b", status: "queued", targetKey: null, createdAt: 1 },
      { key: "c", status: "committed", targetKey: null, createdAt: 9 },
      { key: "d", status: "extracting", targetKey: "team_game_stats", createdAt: 8 },
      { key: "e", status: "failed", targetKey: null, createdAt: 3 },
      { key: "f", status: "rejected", targetKey: "standings", createdAt: 7 },
    ];
    expect(attachableSets(sets).map((s) => s.key)).toEqual(["e", "b", "f", "a"]);
  });
});

import { describe, expect, test } from "vitest";
import { draftFromGoal, NEW_GOAL, specFromDraft, withScope } from "./goalDraft";

describe("goal drafts", () => {
  test("a wins goal parses its target", () => {
    expect(specFromDraft({ ...NEW_GOAL, type: "wins", target: "11" })).toEqual({
      spec: { scope: "team", type: "wins", target: 11 },
    });
    expect(specFromDraft({ ...NEW_GOAL, type: "wins", target: "" })).toEqual({
      error: expect.stringMatching(/whole number/),
    });
  });

  test("fields of another kind of goal are dropped, not sent", () => {
    const draft = { ...NEW_GOAL, type: "playoffs" as const, target: "9", statKey: "passYds", text: "x" };
    expect(specFromDraft(draft)).toEqual({ spec: { scope: "team", type: "playoffs" } });
  });

  test("a player stat goal needs a player, a stat and a target", () => {
    const player = withScope(NEW_GOAL, "player");
    expect(player.type).toBe("stat");
    expect(specFromDraft(player)).toEqual({ error: "Pick a player" });
    expect(specFromDraft({ ...player, playerId: "p1", statKey: "passInt", target: "8" })).toEqual({
      spec: { scope: "player", type: "stat", playerId: "p1", statKey: "passInt", target: 8 },
    });
  });

  test("an existing goal round-trips", () => {
    const draft = draftFromGoal({ scope: "team", type: "custom", text: "Beat Buffalo", outcome: "hit" });
    expect(draft).toMatchObject({ text: "Beat Buffalo", outcome: "hit", target: "" });
    expect(specFromDraft(draft)).toEqual({ spec: { scope: "team", type: "custom", text: "Beat Buffalo" } });
    expect(withScope(draft, "team")).toBe(draft);
  });
});

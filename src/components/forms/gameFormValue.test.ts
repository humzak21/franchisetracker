import { describe, expect, it } from "vitest";
import { emptyGameForm, firstOpenWeek, toGameInput } from "./gameFormValue";

describe("firstOpenWeek", () => {
  it("picks the week after the latest game, skipping taken weeks", () => {
    expect(firstOpenWeek(["w1", "w2", "w3"])).toBe("w4");
    expect(firstOpenWeek(["pre1", "w1", "w3"])).toBe("w4");
  });

  it("starts an empty season at week 1 and falls back to the first open week", () => {
    expect(firstOpenWeek([])).toBe("w1");
    expect(firstOpenWeek(["sb"])).toBe("pre1");
  });
});

describe("toGameInput", () => {
  it("parses scores and leaves blanks empty", () => {
    const value = { ...emptyGameForm("w2"), opponentTeamId: "kc", us: " 24 ", them: "" };
    expect(toGameInput(value)).toMatchObject({ weekKey: "w2", opponentTeamId: "kc", us: 24, them: null });
    expect(toGameInput(emptyGameForm("w2")).opponentTeamId).toBeUndefined();
  });
});

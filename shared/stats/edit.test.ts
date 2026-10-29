import { describe, expect, test } from "vitest";
import { checkStatEdit, withStat } from "./edit";

describe("stat edits", () => {
  test("recorded stats and games played can be typed, rates cannot", () => {
    expect(checkStatEdit("passYds", 4200)).toEqual({ ok: true });
    expect(checkStatEdit("gamesPlayed", 17)).toEqual({ ok: true });
    expect(checkStatEdit("passYds", null)).toEqual({ ok: true });
    expect(checkStatEdit("passRating", 101.2)).toMatchObject({ ok: false });
    expect(checkStatEdit("notAStat", 1)).toMatchObject({ ok: false });
  });

  test("numbers are checked", () => {
    expect(checkStatEdit("passYds", 12.5)).toMatchObject({ ok: false, error: "Use a whole number" });
    expect(checkStatEdit("sacks", 12.5)).toEqual({ ok: true });
    expect(checkStatEdit("rushYds", -4)).toEqual({ ok: true });
    expect(checkStatEdit("gamesPlayed", 40)).toMatchObject({ ok: false });
    expect(checkStatEdit("passYds", Number.NaN)).toMatchObject({ ok: false });
  });

  test("a cleared value leaves the line", () => {
    expect(withStat({ passYds: 10, passTd: 1 }, "passTd", null)).toEqual({ passYds: 10 });
    expect(withStat({ passYds: 10 }, "passTd", 2)).toEqual({ passYds: 10, passTd: 2 });
  });
});

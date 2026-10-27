import { describe, expect, it } from "vitest";
import { parseLine, rawStatsIn } from "./lineDraft";

describe("lineDraft", () => {
  it("lists only recorded stats for a category", () => {
    const kicking = rawStatsIn("kicking");
    expect(kicking).toContain("fgm");
    expect(kicking).not.toContain("fgPct");
  });

  it("parses filled inputs and skips blanks", () => {
    expect(parseLine({ passYds: " 250 ", passTd: "", sacks: "1.5" })).toEqual({
      ok: true,
      stats: { passYds: 250, sacks: 1.5 },
    });
  });

  it("refuses junk and an empty line", () => {
    expect(parseLine({ passYds: "lots" })).toEqual({ ok: false, error: "Passing yards: not a valid number" });
    expect(parseLine({ passYds: "" })).toEqual({ ok: false, error: "Enter at least one stat" });
  });
});

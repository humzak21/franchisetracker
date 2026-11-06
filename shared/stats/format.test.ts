import { describe, expect, it } from "vitest";
import { formatRank, parseRank } from "./format";

describe("parseRank", () => {
  it("reads a rank the way it is typed or printed", () => {
    expect(parseRank("3")).toEqual({ rank: 3, tied: false });
    expect(parseRank(" 21st ")).toEqual({ rank: 21, tied: false });
    expect(parseRank("T-3rd")).toEqual({ rank: 3, tied: true });
    expect(parseRank("t4")).toEqual({ rank: 4, tied: true });
  });

  it("round-trips what formatRank prints", () => {
    expect(parseRank(formatRank(12, true))).toEqual({ rank: 12, tied: true });
  });

  it("is null for anything else", () => {
    expect(parseRank("")).toBeNull();
    expect(parseRank("0")).toBeNull();
    expect(parseRank("third")).toBeNull();
  });
});

import { describe, expect, test } from "vitest";
import { digestHeadline, digestText, standingLine, type WeekDigest } from "./digest";

const digest: WeekDigest = {
  teamName: "Eagles",
  opponentName: "Cowboys",
  weekKey: "w9",
  result: "W",
  us: 31,
  them: 24,
  home: true,
  overtime: false,
  record: { w: 7, l: 2, t: 0 },
  streak: "W4",
  stars: [
    { name: "Jalen Hurts", statLine: "22/30, 284 yds, 3 TD" },
    { name: "Saquon Barkley", statLine: null },
  ],
  records: ["Saquon Barkley set the franchise record for rushing yards"],
  milestones: ["Jalen Hurts: first 300-yard game"],
  division: "NFC East",
  standing: { rank: 1, previous: 2 },
};

describe("a place in the division", () => {
  test("says which way it moved", () => {
    expect(standingLine({ rank: 1, previous: 2 }, "NFC East")).toBe("1st in the NFC East, up from 2nd");
    expect(standingLine({ rank: 3, previous: 2 }, "NFC East")).toBe("3rd in the NFC East, down from 2nd");
  });

  test("a place held is just the place", () => {
    expect(standingLine({ rank: 2, previous: 2 }, "AFC West")).toBe("2nd in the AFC West");
  });
});

describe("the week as text", () => {
  test("reads home and away, with overtime", () => {
    expect(digestHeadline(digest)).toBe("Week 9: W 31-24 vs Cowboys");
    expect(digestHeadline({ ...digest, home: false, overtime: true })).toBe("Week 9: W 31-24 at Cowboys, OT");
  });

  test("copies as a message", () => {
    expect(digestText(digest)).toBe(
      [
        "Eagles Week 9: W 31-24 vs Cowboys",
        "7-2, W4 · 1st in the NFC East, up from 2nd",
        "- Jalen Hurts: 22/30, 284 yds, 3 TD",
        "- Saquon Barkley",
        "- Saquon Barkley set the franchise record for rushing yards",
        "- Jalen Hurts: first 300-yard game",
      ].join("\n"),
    );
  });

  test("leaves out what is not known", () => {
    const text = digestText({
      ...digest,
      standing: null,
      streak: null,
      stars: [],
      records: [],
      milestones: [],
    });
    expect(text).toBe("Eagles Week 9: W 31-24 vs Cowboys\n7-2");
  });
});

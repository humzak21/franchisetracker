import { describe, expect, test } from "vitest";
import { isTypedStatLine, starStatLine } from "./starLine";

describe("starStatLine", () => {
  test("a quarterback leads with passing, then his rushing", () => {
    expect(
      starStatLine("QB", {
        passCmp: 22,
        passAtt: 35,
        passYds: 452,
        passTd: 3,
        passInt: 1,
        rushAtt: 2,
        rushYds: 12,
        rushTd: 1,
      }),
    ).toBe("22/35, 62.9%, 452 yds, 3 TD, 1 INT, 2 ATT, 12 yds, 1 TD");
  });

  test("a quarterback without an interception or a carry leaves them out", () => {
    expect(starStatLine("QB", { passCmp: 20, passAtt: 25, passYds: 301, passTd: 2 })).toBe(
      "20/25, 80.0%, 301 yds, 2 TD",
    );
  });

  test("a running back's carries, then his catches; no touchdown means no TD", () => {
    expect(starStatLine("HB", { rushAtt: 19, rushYds: 123, rushTd: 2, rec: 1, recYds: 4 })).toBe(
      "19 ATT, 123 yds, 2 TD, 1 rec, 4 yds",
    );
  });

  test("receivers and tight ends lead with catches", () => {
    expect(starStatLine("WR", { rec: 4, recYds: 121, recTd: 1, rushAtt: 1, rushYds: 7 })).toBe(
      "4 rec, 121 yds, 1 TD, 1 ATT, 7 yds",
    );
    expect(starStatLine("TE", { rec: 6, recYds: 58 })).toBe("6 rec, 58 yds");
  });

  test("a defender shows every number that is not zero", () => {
    expect(
      starStatLine("MLB", {
        tackles: 6,
        tacklesForLoss: 4,
        sacks: 1.5,
        defInt: 1,
        passDeflections: 1,
        forcedFumbles: 1,
        fumbleRecoveries: 1,
        defTd: 1,
      }),
    ).toBe("6 TKLs, 4 TFLs, 1.5 sacks, 1 INT, 1 PDEF, 1 FF, 1 FR, 1 TD");
    expect(starStatLine("CB", { tackles: 1, sacks: 1, defInt: 2, passDeflections: 0 })).toBe(
      "1 TKL, 1 sack, 2 INT",
    );
  });

  test("specialists and returners get their own line", () => {
    expect(starStatLine("K", { fgm: 3, fga: 4, fgLong: 52, xpm: 2, xpa: 2 })).toBe("3/4 FG, 52 long, 2/2 XP");
    expect(starStatLine("P", { punts: 5, puntYds: 241, puntIn20: 3 })).toBe("5 punts, 241 yds, 3 IN20");
    expect(starStatLine("WR", { kickReturns: 3, kickReturnYds: 140, kickReturnTd: 1 })).toBe(
      "3 KR, 140 yds, 1 TD",
    );
  });

  test("nothing in the box score is no line", () => {
    expect(starStatLine("LT", {})).toBeNull();
    expect(starStatLine("QB", {})).toBeNull();
  });
});

describe("isTypedStatLine", () => {
  test("captions that are only numbers are stat lines", () => {
    for (const caption of [
      "22/30, 284 yds, 3 TD",
      "8 rec, 131 yds, 1 TD",
      "2 sacks",
      "2 rush TD",
      "INT, 3 PD",
      "25/36, 69.4%, 301 yds",
      "12 tackles · 1.5 sacks",
    ]) {
      expect(isTypedStatLine(caption), caption).toBe(true);
    }
  });

  test("captions that say anything else are notes", () => {
    for (const caption of ["Game-winning drive in the fourth", "Pick-six to seal it, 1 INT", "MVP", ""]) {
      expect(isTypedStatLine(caption), caption).toBe(false);
    }
  });
});

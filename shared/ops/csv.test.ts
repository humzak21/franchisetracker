import { describe, expect, test } from "vitest";
import { gamesCsv, playerSeasonsCsv, toCsv } from "./csv";

describe("csv", () => {
  test("quotes fields with commas, quotes and line breaks; blanks nulls", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x, y", 'say "hi"'],
          [null, "two\nlines"],
        ],
      ),
    ).toBe('a,b\r\n"x, y","say ""hi"""\r\n,"two\nlines"\r\n');
  });

  test("games in season order with readable weeks", () => {
    const csv = gamesCsv([
      {
        year: 2027,
        weekKey: "wc",
        userIsHome: false,
        opponentName: "Buffalo Bills",
        us: 20,
        them: 17,
        result: "W",
      },
      {
        year: 2026,
        weekKey: "w1",
        userIsHome: true,
        opponentName: "Las Vegas Raiders",
        us: 31,
        them: 17,
        result: "W",
      },
    ]);
    expect(csv.split("\r\n").slice(0, 3)).toEqual([
      "season,week,home_away,opponent,points_for,points_against,result",
      "2026,Week 1,home,Las Vegas Raiders,31,17,W",
      "2027,Wild Card,away,Buffalo Bills,20,17,W",
    ]);
  });

  test("player seasons get a column per stat anyone recorded", () => {
    const csv = playerSeasonsCsv([
      {
        year: 2026,
        split: "regular",
        player: "Drake Maye",
        position: "QB",
        gamesPlayed: 5,
        totals: { passYds: 1403, passTd: 11 },
      },
      {
        year: 2026,
        split: "regular",
        player: "Stefon Diggs",
        position: "WR",
        gamesPlayed: 5,
        totals: { recYds: 512 },
      },
    ]);
    const [header, maye, diggs] = csv.split("\r\n");
    expect(header).toBe("season,split,player,position,games,passYds,passTd,recYds");
    expect(maye).toBe("2026,regular,Drake Maye,QB,5,1403,11,");
    expect(diggs).toBe("2026,regular,Stefon Diggs,WR,5,,,512");
  });
});

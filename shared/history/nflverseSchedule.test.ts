import { describe, expect, test } from "vitest";
import { kickoffLabel, parseSchedule } from "./nflverseSchedule";

const CSV = `season,game_type,week,weekday,gametime,away_team,away_score,home_team,home_score
2026,REG,1,Thursday,20:20,DAL,,PHI,
2026,REG,1,Sunday,13:00,OAK,,KC,
2026,REG,18,Sunday,16:25,NE,,BUF,
2025,REG,1,Sunday,13:00,NYJ,17,NE,24
2026,WC,19,Saturday,16:30,PIT,,BAL,`;

describe("nflverse schedule", () => {
  test("reads one season's regular season, matchups and kickoff only", () => {
    expect(parseSchedule(CSV, 2026)).toEqual([
      { weekKey: "w1", away: "DAL", home: "PHI", timeLabel: "Thu 8:20 PM" },
      { weekKey: "w1", away: "LV", home: "KC", timeLabel: "Sun 1:00 PM" },
      { weekKey: "w18", away: "NE", home: "BUF", timeLabel: "Sun 4:25 PM" },
    ]);
  });

  test("kickoff labels", () => {
    expect(kickoffLabel("Monday", "00:15")).toBe("Mon 12:15 AM");
    expect(kickoffLabel("", "12:05")).toBe("12:05 PM");
    expect(kickoffLabel("Sunday", "")).toBeUndefined();
  });
});

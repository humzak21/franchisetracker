import { describe, expect, it } from "vitest";
import { cleanText, droppedTeams, gameFields } from "./gameForm";

const USER = "user";

describe("gameFields", () => {
  it("stores a home win from the user's side as home/away scores", () => {
    const out = gameFields({ weekKey: "w3", bye: false, opponentTeamId: "opp", us: 27, them: 20 }, USER);
    expect(out).toMatchObject({
      ok: true,
      value: {
        status: "played",
        homeTeamId: USER,
        awayTeamId: "opp",
        homeScore: 27,
        awayScore: 20,
        result: "W",
        userIsHome: true,
        playoffRound: undefined,
      },
    });
  });

  it("flips the scores for a road game and marks overtime only when scored", () => {
    const road = gameFields(
      {
        weekKey: "wc",
        bye: false,
        opponentTeamId: "opp",
        userIsHome: false,
        us: 17,
        them: 20,
        overtime: true,
      },
      USER,
    );
    expect(road).toMatchObject({
      ok: true,
      value: {
        homeTeamId: "opp",
        homeScore: 20,
        awayScore: 17,
        result: "L",
        overtime: true,
        playoffRound: "wc",
      },
    });
    const unplayed = gameFields({ weekKey: "w5", bye: false, opponentTeamId: "opp", overtime: true }, USER);
    expect(unplayed).toMatchObject({
      ok: true,
      value: { status: "scheduled", overtime: undefined, result: undefined },
    });
  });

  it("clears teams and scores for a bye", () => {
    const out = gameFields({ weekKey: "w6", bye: true, opponentTeamId: "opp", us: 3, them: 0 }, USER);
    expect(out).toMatchObject({
      ok: true,
      value: { status: "bye", opponentTeamId: undefined, homeScore: undefined },
    });
  });

  it("refuses a missing opponent, a self game, one score and bad numbers", () => {
    expect(gameFields({ weekKey: "w1", bye: false }, USER)).toEqual({
      ok: false,
      error: "Pick the opponent",
    });
    expect(gameFields({ weekKey: "w1", bye: false, opponentTeamId: USER }, USER).ok).toBe(false);
    expect(gameFields({ weekKey: "w1", bye: false, opponentTeamId: "opp", us: 10 }, USER)).toEqual({
      ok: false,
      error: "Enter both scores, or neither",
    });
    expect(gameFields({ weekKey: "w1", bye: false, opponentTeamId: "opp", us: -1, them: 3 }, USER).ok).toBe(
      false,
    );
    expect(gameFields({ weekKey: "w1", bye: false, opponentTeamId: "opp", us: 2.5, them: 3 }, USER).ok).toBe(
      false,
    );
  });

  it("trims text and rejects text that is too long", () => {
    const out = gameFields({ weekKey: "w1", bye: true, stadium: "  Gillette  ", weather: "   " }, USER);
    expect(out).toMatchObject({ ok: true, value: { stadium: "Gillette", weather: undefined } });
    expect(gameFields({ weekKey: "w1", bye: true, dateLabel: "x".repeat(41) }, USER).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("cleanText blanks whitespace", () => {
    expect(cleanText("  a ")).toBe("a");
    expect(cleanText(" ")).toBeUndefined();
    expect(cleanText(null)).toBeUndefined();
  });

  it("droppedTeams lists sides that left the game", () => {
    expect(droppedTeams({ homeTeamId: "a", awayTeamId: "b" }, { homeTeamId: "b", awayTeamId: "a" })).toEqual(
      [],
    );
    expect(droppedTeams({ homeTeamId: "a", awayTeamId: "b" }, { homeTeamId: "a", awayTeamId: "c" })).toEqual([
      "b",
    ]);
    expect(droppedTeams({ homeTeamId: "a", awayTeamId: "b" }, {})).toEqual(["a", "b"]);
  });
});

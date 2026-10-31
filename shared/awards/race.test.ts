import { describe, expect, test } from "vitest";
import { awardsRace, defensePoints, leaderLine, RACE_SIZE, raceEntrants, type RaceEntrant } from "./race";

const entrant = (over: Partial<RaceEntrant<string, string>>): RaceEntrant<string, string> => ({
  playerId: "p",
  teamId: "BUF",
  position: "HB",
  rookie: false,
  games: 17,
  line: {},
  partial: false,
  ...over,
});
const ours = (team: string) => team === "PHI";
const ids = (rows: { playerId: string }[]) => rows.map((r) => r.playerId);

describe("the awards race", () => {
  const qb = entrant({ playerId: "qb", position: "QB", line: { passYds: 4000, passTd: 30 } });
  const back = entrant({ playerId: "back", line: { rushYds: 1500, rushTd: 12 } });
  const rookie = entrant({
    playerId: "rookie",
    position: "WR",
    rookie: true,
    line: { rec: 60, recYds: 800 },
  });
  const edge = entrant({ playerId: "edge", position: "LEDG", line: { tackles: 40, sacks: 15 } });
  const lineman = entrant({ playerId: "line", position: "LT", line: {} });

  test("each award keeps to its own players", () => {
    const race = awardsRace([qb, back, rookie, edge, lineman], ours);
    expect(ids(race.MVP)).toEqual(["qb", "back", "rookie"]);
    expect(ids(race.OPOY)).toEqual(["back", "rookie"]);
    expect(ids(race.DPOY)).toEqual(["edge"]);
    expect(ids(race.OROY)).toEqual(["rookie"]);
  });

  test("rows say how far behind the leader they are", () => {
    const [first, second] = awardsRace([qb, back], ours).MVP;
    expect(first).toMatchObject({ rank: 1, value: 280, behind: 0 });
    expect(second).toMatchObject({ rank: 2, value: 222, behind: 58 });
  });

  test("level players share a rank", () => {
    const race = awardsRace([back, { ...back, playerId: "twin" }], ours);
    expect(race.OPOY.map((r) => r.rank)).toEqual([1, 1]);
  });

  test("our best joins the list from wherever it stands", () => {
    const field = Array.from({ length: 8 }, (_, i) =>
      entrant({ playerId: `p${i}`, line: { rushYds: 1000 - i } }),
    );
    const mine = entrant({ playerId: "mine", teamId: "PHI", line: { rushYds: 100 } });
    const also = entrant({ playerId: "also", teamId: "PHI", line: { rushYds: 50 } });
    const rows = awardsRace([...field, mine, also], ours).OPOY;
    expect(rows).toHaveLength(RACE_SIZE + 1);
    expect(rows.at(-1)).toMatchObject({ playerId: "mine", rank: 9 });
  });

  test("a line from nothing scores nothing", () => {
    expect(defensePoints({})).toBe(0);
    expect(awardsRace([lineman], ours).MVP).toEqual([]);
  });
});

describe("who is in the race", () => {
  const about = (id: string) =>
    id === "ghost" ? null : { position: "HB" as const, rookie: id === "rookie" };

  test("a traded player sums under the team they finished with", () => {
    const [entrant] = raceEntrants(
      [
        { playerId: "a", teamId: "BUF", gamesPlayed: 8, totals: { rushYds: 400 } },
        { playerId: "a", teamId: "PHI", gamesPlayed: 9, totals: { rushYds: 500 } },
      ],
      [],
      about,
    );
    expect(entrant).toMatchObject({ teamId: "PHI", games: 17, line: { rushYds: 900 }, partial: false });
  });

  test("a leaders screen adds who no season stats name, marked partial", () => {
    const entrants = raceEntrants(
      [{ playerId: "a", teamId: "BUF", gamesPlayed: 8, totals: { rushYds: 400 } }],
      [
        { playerId: "a", teamId: "BUF", statKey: "rushYds", value: 999 },
        { playerId: "b", teamId: "DAL", statKey: "rushYds", value: 1200 },
        { playerId: "b", teamId: "DAL", statKey: "rushTd", value: 11 },
      ],
      about,
    );
    expect(entrants).toHaveLength(2);
    expect(entrants[0]).toMatchObject({ playerId: "a", line: { rushYds: 400 } });
    expect(entrants[1]).toMatchObject({
      playerId: "b",
      partial: true,
      line: { rushYds: 1200, rushTd: 11 },
    });
  });

  test("a row nobody can place is left out", () => {
    const entrants = raceEntrants(
      [{ playerId: "ghost", teamId: "BUF", gamesPlayed: 1, totals: {} }],
      [
        { statKey: "rushYds", value: 1 },
        { playerId: "b", statKey: "rushYds", value: 1 },
      ],
      about,
    );
    expect(entrants).toEqual([]);
  });

  test("a leader row keeps only stats a line can hold", () => {
    expect(
      leaderLine([
        { statKey: "passRating", value: 104 },
        { statKey: "nope", value: 1 },
      ]),
    ).toEqual({});
  });
});

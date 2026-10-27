/**
 * A canned model answer for local test deployments with no OpenRouter key (`AUTH_TEST_MODE`).
 * It goes through the same normalize, resolve, validate and commit path as a real answer, so
 * Playwright and local development exercise the whole loop without a network call or a bill.
 */
import { isRowTarget, type TargetKey } from "../../shared/ingestion/targets";
import { fixtureRows } from "./fixtureRows";

type Teams = { home: string; away: string; userIsHome: boolean };

const row = (
  team: string,
  name: string,
  position: string,
  stats: Record<string, number>,
  unclear: string[] = [],
) => ({
  team,
  name,
  position,
  confidence: unclear.length > 0 ? 0.85 : 0.95,
  unclear_fields: unclear,
  ...stats,
});

export function fixtureAnswer(target: TargetKey, { home, away, userIsHome }: Teams): unknown {
  const us = userIsHome ? home : away;
  const them = userIsHome ? away : home;
  if (target === "game_log")
    return {
      ...(fixtureAnswer("game_box_score", { home, away, userIsHome }) as object),
      ...(fixtureAnswer("team_game_stats", { home, away, userIsHome }) as object),
    };
  if (isRowTarget(target)) return fixtureRows(target, us, { home, away, userIsHome });
  const header = {
    home_team: home,
    away_team: away,
    home_score: userIsHome ? 31 : 17,
    away_score: userIsHome ? 17 : 31,
    overtime: false,
    home_quarters: userIsHome ? [7, 14, 3, 7] : [3, 7, 0, 7],
    away_quarters: userIsHome ? [3, 7, 0, 7] : [7, 14, 3, 7],
  };
  if (target === "team_game_stats") {
    return {
      ...header,
      teams: [
        {
          team: us,
          first_downs: 24,
          total_yds: 412,
          pass_yds: 284,
          rush_yds: 128,
          third_down_conv: 7,
          third_down_att: 12,
          turnovers: 0,
          penalties: 4,
          penalty_yds: 35,
          time_of_possession: "32:14",
          confidence: 0.95,
          unclear_fields: [],
        },
        {
          team: them,
          first_downs: 16,
          total_yds: 301,
          pass_yds: 215,
          rush_yds: 86,
          third_down_conv: 4,
          third_down_att: 13,
          turnovers: 2,
          penalties: 6,
          penalty_yds: 50,
          time_of_possession: "27:46",
          confidence: 0.9,
          unclear_fields: ["penalty_yds"],
        },
      ],
    };
  }
  return {
    ...header,
    passing: [
      row(us, "D. Maye", "QB", {
        pass_cmp: 22,
        pass_att: 30,
        pass_yds: 284,
        pass_td: 3,
        pass_int: 0,
        pass_long: 41,
        pass_sacked: 1,
      }),
      row(them, "G. Smith", "QB", {
        pass_cmp: 19,
        pass_att: 33,
        pass_yds: 215,
        pass_td: 1,
        pass_int: 2,
        pass_long: 38,
      }),
    ],
    rushing: [
      row(us, "T. Henderson", "HB", { rush_att: 18, rush_yds: 104, rush_td: 1, rush_long: 23 }, ["rush_yds"]),
      row(us, "D. Maye", "QB", { rush_att: 4, rush_yds: 24, rush_td: 0, rush_long: 11 }),
      row(them, "A. Jeanty", "HB", { rush_att: 16, rush_yds: 86, rush_td: 1, rush_long: 19 }),
    ],
    receiving: [
      row(us, "S. Diggs", "WR", { rec: 8, rec_targets: 10, rec_yds: 131, rec_td: 2, rec_long: 41 }),
      row(us, "H. Henry", "TE", { rec: 6, rec_targets: 8, rec_yds: 88, rec_td: 1, rec_long: 22 }),
      row(us, "T. Henderson", "HB", { rec: 8, rec_targets: 9, rec_yds: 65, rec_td: 0, rec_long: 15 }),
      row(them, "B. Bowers", "TE", { rec: 9, rec_targets: 12, rec_yds: 120, rec_td: 1, rec_long: 38 }),
      row(them, "J. Meyers", "WR", { rec: 10, rec_targets: 15, rec_yds: 95, rec_td: 0, rec_long: 21 }),
    ],
    defense: [
      row(us, "C. Gonzalez", "CB", { tackles: 4, def_int: 2, pass_deflections: 3 }),
      row(us, "R. Spillane", "MLB", { tackles: 9, sacks: 1.5, tackles_for_loss: 2 }),
      row(them, "M. Crosby", "LEDG", { tackles: 5, sacks: 1 }),
    ],
    kicking: [
      row(us, "A. Borregales", "K", { fgm: 1, fga: 1, fg_long: 44, xpm: 4, xpa: 4 }),
      row(them, "D. Carlson", "K", { fgm: 1, fga: 2, fg_long: 39, xpm: 2, xpa: 2 }),
    ],
    punting: [],
    returns: [],
  };
}

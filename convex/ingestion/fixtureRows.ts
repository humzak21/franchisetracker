/**
 * Canned answers for the row targets on a local test deployment without OpenRouter, shaped like
 * a model's answer so they go through the same normalize, merge, resolve and commit path.
 * Names come from the sample franchise so they resolve to its players.
 */
import type { RowTargetKey } from "../../shared/ingestion/rows/targets";
import { fixtureLeagueTeams } from "./fixtureLeagueTeams";
import { fixtureSchedule } from "./fixtureSchedule";
import { FIXTURE_TEAM_HISTORY } from "./fixtureTeamHistory";

const sure = { confidence: 0.95, unclear_fields: [] as string[] };
const unsure = (...fields: string[]) => ({ confidence: 0.7, unclear_fields: fields });

export function fixtureRows(
  target: RowTargetKey,
  us: string,
  game: { home: string; away: string; userIsHome: boolean },
): Record<string, unknown> {
  switch (target) {
    case "league_schedule":
      return fixtureSchedule(game);
    case "season_player_stats":
      return {
        passing: [
          {
            name: "D. Maye",
            team: us,
            position: "QB",
            games_played: 6,
            pass_cmp: 120,
            pass_att: 175,
            pass_yds: 1450,
            pass_td: 11,
            pass_int: 3,
            ...sure,
          },
        ],
        rushing: [
          {
            name: "T. Henderson",
            team: us,
            position: "HB",
            games_played: 6,
            rush_att: 70,
            rush_yds: 478,
            rush_td: 4,
            ...unsure("rush_yds"),
          },
        ],
        receiving: [
          {
            name: "S. Diggs",
            team: us,
            position: "WR",
            games_played: 6,
            rec: 31,
            rec_yds: 531,
            rec_td: 4,
            ...sure,
          },
        ],
        defense: [],
        kicking: [],
        punting: [],
        returns: [],
      };
    case "league_leaders":
      return {
        stat: "passYds",
        rows: [
          { rank: 1, name: "J. Allen", team: "BUF", value: 1620, ...sure },
          { rank: 2, name: "D. Maye", team: us, value: 1450, ...sure },
          { rank: 3, name: "P. Mahomes", team: "KC", value: 1398, ...unsure("value") },
        ],
      };
    case "league_team_stats":
      return fixtureLeagueTeams();
    case "records_list":
      return {
        book: "league",
        scope: "career",
        split: "regular",
        stat: "sacks",
        rows: [
          { rank: 1, name: "Bruce Smith", team: "BUF", year: 2003, value: 200, ...sure },
          { rank: 2, name: "Reggie White", team: "PHI", year: 2000, value: 198, ...sure },
          { rank: 3, name: "Kevin Greene", team: "PIT", year: 1999, value: 160, ...unsure("team") },
        ],
      };
    case "team_history":
      return FIXTURE_TEAM_HISTORY;
    case "team_season_stats":
      return {
        team: us,
        rows: [
          { stat: "pointsPg", value: 28.0, rank: 3, tied: false, ...sure },
          { stat: "yardsPg", value: 371.4, rank: 6, tied: false, ...sure },
          { stat: "pointsAllowedPg", value: 21.6, rank: 12, tied: true, ...unsure("rank") },
        ],
      };
    case "standings":
      return {
        rows: [
          {
            team: us,
            w: 4,
            l: 1,
            t: 0,
            division_rank: 1,
            seed: 2,
            points_for: 140,
            points_against: 108,
            ...sure,
          },
          {
            team: "BUF",
            w: 3,
            l: 2,
            t: 0,
            division_rank: 2,
            seed: null,
            points_for: 131,
            points_against: 120,
            ...sure,
          },
          {
            team: "MIA",
            w: 2,
            l: 3,
            t: 0,
            division_rank: 3,
            seed: null,
            points_for: 98,
            points_against: 117,
            ...sure,
          },
          {
            team: "NYJ",
            w: 1,
            l: 4,
            t: 0,
            division_rank: 4,
            seed: null,
            points_for: 80,
            points_against: 140,
            ...unsure("points_for"),
          },
        ],
      };
    case "weekly_awards":
      return {
        rows: [
          {
            award: "OPOW",
            conference: "AFC",
            name: "D. Maye",
            team: us,
            position: "QB",
            stat_line: "22/30, 284 yds, 3 TD",
            ...sure,
          },
          {
            award: "DPOW",
            conference: "NFC",
            name: "M. Parsons",
            team: "GB",
            position: "LEDG",
            stat_line: "3 sacks",
            ...sure,
          },
        ],
      };
    case "yearly_awards":
      return {
        rows: [
          {
            award: "MVP",
            conference: null,
            name: "D. Maye",
            team: us,
            position: "QB",
            stat_line: "4,612 yds, 38 TD",
            ...sure,
          },
          {
            award: "AllPro1",
            conference: null,
            name: "C. Gonzalez",
            team: us,
            position: "CB",
            stat_line: null,
            ...sure,
          },
        ],
      };
    case "draft_results":
      return {
        rows: [
          {
            round: 1,
            pick_in_round: 28,
            name: "Rookie Corner",
            team: us,
            position: "CB",
            college: "Georgia",
            age: 21,
            ovr: 72,
            ...sure,
          },
          {
            round: 2,
            pick_in_round: 28,
            name: "R.Tackle",
            team: us,
            position: "LT",
            ovr: 68,
            ...unsure("ovr"),
          },
        ],
      };
    case "roster_page":
      return {
        team: us,
        rows: [
          {
            name: "D. Maye",
            position: "QB",
            jersey: 10,
            ovr: 81,
            age: 23,
            exp: 2,
            dev_trait: "star",
            ...sure,
          },
          {
            name: "S. Diggs",
            position: "WR",
            jersey: 8,
            ovr: 86,
            age: 32,
            exp: 11,
            dev_trait: "normal",
            ...sure,
          },
        ],
      };
    case "transactions":
      return {
        rows: [
          {
            type: "sign",
            name: "Veteran Safety",
            team: us,
            week: "w6",
            counterpart: null,
            detail: "1 yr, $2.5M",
            ...sure,
          },
        ],
      };
    case "injury_report":
      return {
        rows: [
          {
            name: "H. Henry",
            team: us,
            position: "TE",
            injury: "Ankle sprain",
            length: "2-4 weeks",
            weeks: 3,
            ir: false,
            ...sure,
          },
        ],
      };
    case "player_card":
      return {
        rows: [
          {
            name: "Drake Maye",
            team: us,
            position: "QB",
            jersey: 10,
            ovr: 82,
            age: 23,
            dev_trait: "star",
            college: "North Carolina",
            height_in: 76,
            weight_lb: 225,
            contract_years: 3,
            contract_apy: 9_200_000,
            contract_expires: 2028,
            abilities: "Bazooka, Pocket Deadeye",
            ...sure,
          },
        ],
      };
  }
}

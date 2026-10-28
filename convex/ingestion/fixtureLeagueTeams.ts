/** The canned league team stats answer: every tab of the NFL team stats screen, from real captures. */
const sure = { confidence: 0.95, unclear_fields: [] as string[] };
const unsure = (...fields: string[]) => ({ confidence: 0.7, unclear_fields: fields });

export function fixtureLeagueTeams(): Record<string, unknown> {
  return {
    offense: [
      {
        team: "Bengals",
        total_yds: 6824,
        pass_yds: 5590,
        rush_yds: 846,
        points_pg: 26.9,
        pass_td: 42,
        rush_td: 12,
        first_downs: 273,
        ...sure,
      },
      {
        team: "Bills",
        total_yds: 6775,
        pass_yds: 4605,
        rush_yds: 1657,
        points_pg: 27.8,
        pass_td: 49,
        rush_td: 12,
        first_downs: 293,
        ...sure,
      },
      {
        team: "Patriots",
        total_yds: 8610,
        pass_yds: 4454,
        rush_yds: 3697,
        points_pg: 39.5,
        pass_td: 56,
        rush_td: 39,
        first_downs: 403,
        ...unsure("total_yds"),
      },
    ],
    defense: [
      {
        team: "Bills",
        pass_yds_allowed: 4458,
        rush_yds_allowed: 1697,
        points_allowed: 458,
        sacks: 42,
        fumbles_recovered: 6,
        def_int: 9,
        ...sure,
      },
      {
        team: "Patriots",
        pass_yds_allowed: 4072,
        rush_yds_allowed: 1855,
        points_allowed: 510,
        sacks: 36,
        fumbles_recovered: 5,
        def_int: 5,
        ...sure,
      },
    ],
    conversions: [
      {
        team: "Patriots",
        third_down_conv: 82,
        third_down_att: 130,
        fourth_down_conv: 24,
        fourth_down_att: 38,
        two_pt_conv: 0,
        two_pt_att: 4,
        ...sure,
      },
    ],
    redZone: [
      {
        team: "Patriots",
        red_zone_att: 84,
        red_zone_td: 62,
        red_zone_fg: 1,
        red_zone_def_att: 51,
        red_zone_def_td: 37,
        red_zone_def_fg: 10,
        ...sure,
      },
    ],
    turnovers: [
      { team: "Patriots", int_thrown: 15, fumbles_lost: 6, def_int: 5, fumbles_recovered: 5, ...sure },
    ],
  };
}

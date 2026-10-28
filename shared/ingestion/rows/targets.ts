/**
 * The row targets in the registry: every Madden screen that is a list. Each set is read one
 * screenshot at a time and merged (union of rows), so a long list can span any number of shots.
 */
import {
  draftResultsSpec,
  injuryReportSpec,
  playerCardSpec,
  rosterPageSpec,
  transactionsSpec,
  weeklyAwardsSpec,
  yearlyAwardsSpec,
} from "./peopleSpecs";
import { leagueTeamStatsSpec } from "./leagueTeamSpec";
import { recordsListSpec } from "./recordsSpec";
import { leagueScheduleSpec } from "./scheduleSpec";
import { leagueLeadersSpec, seasonPlayerStatsSpec, standingsSpec, teamSeasonStatsSpec } from "./statSpecs";
import type { RowSpec } from "./types";

/** What a set needs to be filed: a game (or a season and week), a season and week, or a season. */
export type TargetScope = "game" | "week" | "season";

export type RowTargetDef = {
  kind: "rows";
  label: string;
  description: string;
  scope: TargetScope;
  multiImage: boolean;
  instructions: string;
  spec: RowSpec;
};

const rows = (def: Omit<RowTargetDef, "kind">): RowTargetDef => ({ kind: "rows", ...def });

export const ROW_TARGETS = {
  season_player_stats: rows({
    label: "Season stats",
    description:
      "A season stats tab (passing, rushing, defense, ...) for your team or the whole league, with every player's totals",
    scope: "season",
    multiImage: true,
    instructions:
      "This is a Madden season stats screen: one tab (passing, rushing, receiving, defense, kicking, punting or returns) listing players with their season totals and games played, for one team or the whole league. Put each row in the array for the tab shown, with the player's team as printed.",
    spec: seasonPlayerStatsSpec,
  }),
  league_leaders: rows({
    label: "League leaders",
    description: "A league leaders board: the top players in one stat with rank, team and value",
    scope: "season",
    multiImage: true,
    instructions:
      "This is a Madden league leaders screen ranking players in one stat. Set `stat` to the stat being ranked and return one row per player with their rank, team and value.",
    spec: leagueLeadersSpec,
  }),
  records_list: rows({
    label: "Records list",
    description: "Real NFL records from any source: player, team, season and number, top to bottom",
    // Records belong to no season; the set is filed under one like any season screen and commits without it.
    scope: "season",
    multiImage: true,
    instructions:
      "This is a list of real NFL records from a website or book, not a Madden screen: players ranked in one stat. Set `book` (league for an NFL-wide list, team for one franchise's), `scope` (game, season or career, from the title), `split` (postseason only for a playoff list) and `stat`. Return one row per player with the rank, the player's name, the team (for a career, the team named, else the one he is best known with), the season (for a career, the last season) and the number.",
    spec: recordsListSpec,
  }),
  team_season_stats: rows({
    label: "Team season stats",
    description: "One team's season stats with league ranks (27.3 · T-3rd)",
    scope: "season",
    multiImage: true,
    instructions:
      "This is a Madden team stats screen for one team's season: per-game and season figures, each with the team's rank in the league. Return one row per figure; a rank printed with T- is tied.",
    spec: teamSeasonStatsSpec,
  }),
  league_team_stats: rows({
    label: "League team stats",
    description:
      "Every team's season numbers from the NFL team stats screen: offense, defense, conversions, red zone, turnovers",
    scope: "season",
    multiImage: true,
    instructions: [
      "This is Madden's team stats screen in the NFL view: one table listing every team (by nickname, e.g. Bengals) with season numbers.",
      "The R2 label above the table names the tab: Offense, Defense, Conversions, Redzone Efficiency or Turnovers.",
      "Put each team row in the array for that tab (Redzone Efficiency is redZone) and read only that tab's columns.",
      "Columns with the same heading on different tabs mean different things: on Defense, PASS, RUSH and INT are what the defense allowed or picked off; on Turnovers, INT is interceptions thrown and D INT interceptions made.",
      "Leave out OFF, the defense TOTAL, every percentage column, GIVE, TAKE and DIFF: the app computes them.",
    ].join(" "),
    spec: leagueTeamStatsSpec,
  }),
  standings: rows({
    label: "Standings",
    description: "Division or conference standings: records, division rank, seeds and points",
    scope: "season",
    multiImage: true,
    instructions:
      "This is a Madden standings screen. Return one row per team with wins, losses, ties, division rank, playoff seed and points for and against where shown.",
    spec: standingsSpec,
  }),
  league_schedule: rows({
    label: "Schedule / scores",
    description: "A week's games across the league (or several weeks at once), with final scores once played",
    scope: "week",
    multiImage: true,
    instructions:
      "This is the Madden league schedule screen for one week: a list of every game with its game time, matchup (away @ home, team nicknames) and result (away abbreviation and score first, then home score and abbreviation). Return one row per game; scores are null for a game not played yet. Set `week` from the header (SEASON WEEK 15 is w15). The screenshots may cover several weeks (the whole schedule at once): set each row's `week` from the header of the screen that game is on.",
    spec: leagueScheduleSpec,
  }),
  weekly_awards: rows({
    label: "Weekly awards",
    description: "Players of the week for the AFC and NFC",
    scope: "week",
    multiImage: true,
    instructions:
      "This is a Madden weekly awards screen: offensive, defensive and special teams players of the week and rookie of the week, per conference. Return one row per winner.",
    spec: weeklyAwardsSpec,
  }),
  yearly_awards: rows({
    label: "Yearly awards",
    description: "MVP, players of the year, All-Pro teams and Pro Bowl rosters",
    scope: "season",
    multiImage: true,
    instructions:
      "This is a Madden end-of-season awards screen: MVP and the players of the year, or an All-Pro or Pro Bowl roster. Return one row per honoree with the award and, for All-Pro and Pro Bowl, the position.",
    spec: yearlyAwardsSpec,
  }),
  draft_results: rows({
    label: "Draft results",
    description: "Picks from the draft: round, overall pick, team, player, position, college",
    scope: "season",
    multiImage: true,
    instructions:
      "This is a Madden draft results screen. Return one row per pick with the round, overall pick number, team, player, position, college and OVR where shown.",
    spec: draftResultsSpec,
  }),
  roster_page: rows({
    label: "Roster page",
    description: "A team's roster: names, positions, numbers, OVR, age and dev trait",
    scope: "season",
    multiImage: true,
    instructions:
      "This is a Madden roster screen for one team. Set `team` to whose roster it is and return one row per player.",
    spec: rosterPageSpec,
  }),
  transactions: rows({
    label: "Transactions",
    description: "The transaction log: signings, releases, trades, claims and IR moves",
    scope: "season",
    multiImage: true,
    instructions:
      "This is a Madden transactions screen. Return one row per move with the player, the acting team, the type of move, the week when printed, the other team in a trade and any terms.",
    spec: transactionsSpec,
  }),
  injury_report: rows({
    label: "Injury report",
    description: "Who is hurt this week, with the injury, length and IR status",
    scope: "week",
    multiImage: true,
    instructions:
      "This is a Madden injury report. Return one row per injured player with the injury, how long they are out and whether they are on injured reserve.",
    spec: injuryReportSpec,
  }),
  player_card: rows({
    label: "Player card",
    description: "One player's card: OVR, age, dev trait, abilities, bio and contract",
    scope: "season",
    multiImage: false,
    instructions:
      "This is a Madden player card for one player. Return a single row with everything the card shows.",
    spec: playerCardSpec,
  }),
} as const satisfies Record<string, RowTargetDef>;

export type RowTargetKey = keyof typeof ROW_TARGETS;
export const ROW_TARGET_KEYS = Object.keys(ROW_TARGETS) as [RowTargetKey, ...RowTargetKey[]];

/**
 * The season checklist (FEATURES.md 5.1): what to do and shoot next, in the order a Madden year
 * runs. Every item is worked out from the franchise's data, never ticked by hand. Pure.
 */
import { REGULAR_WEEKS, type SeasonStatus, type WeekKey } from "../domain";
import type { TargetKey } from "../ingestion/targets";
import { RAW_STAT_CATEGORIES, STAT_CATEGORY_LABELS, type StatCategory } from "../stats/registry";
import type { ReportPrompts } from "./reports";

export const CHECKLIST_GROUPS = ["offseason", "preseason", "week", "end"] as const;
export type ChecklistGroupKey = (typeof CHECKLIST_GROUPS)[number];

export const CHECKLIST_GROUP_LABELS: Record<ChecklistGroupKey, string> = {
  offseason: "Offseason",
  preseason: "Preseason",
  week: "This week",
  end: "Season end",
};

/** Screens an item can send the owner to, besides capturing a screen. */
export type ChecklistPlace = "roster" | "transactions" | "goals" | "report";

export type ChecklistAction =
  { kind: "capture"; target: TargetKey } | { kind: "open"; place: ChecklistPlace } | { kind: "retirements" };

export type ChecklistItem = {
  key: string;
  label: string;
  /** What is still missing, or how far it has got. */
  detail?: string;
  done: boolean;
  /** Seasons can pass without it, so it never holds a group open. */
  optional?: boolean;
  action: ChecklistAction;
};

export type ChecklistGroup = { key: ChecklistGroupKey; items: ChecklistItem[] };

export type ChecklistFacts = {
  status: SeasonStatus;
  /** The franchise's first season: nothing carried over, nobody re-signed yet. */
  firstSeason: boolean;
  carried: boolean;
  /** Players still suggested as retired, 0 once the list has been gone through. */
  retirementsWaiting: number;
  /** User-team players whose contract ran out at carry-over. */
  unsigned: number;
  signings: number;
  draftPicks: number;
  rosterPage: boolean;
  depthChart: boolean;
  goals: number;
  prompts: ReportPrompts | null;
  /** The week the weekly items are about: the latest played, or the first to play. */
  week: WeekKey;
  weekHasBoxScore: boolean;
  weekHasAwards: boolean;
  regularGames: number;
  /** The user team's games in the captured standings. */
  standingsGames: number;
  /** Stat categories a captured season stats screen has reported. */
  seasonStats: readonly StatCategory[];
  teamStats: boolean;
  yearlyAwards: number;
  playoffsSettled: boolean;
};

/** Regular-season games a team plays: every week but its bye. */
const SEASON_GAMES = REGULAR_WEEKS.length - 1;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function offseason(f: ChecklistFacts): ChecklistItem[] {
  const carried: ChecklistItem[] = f.firstSeason
    ? []
    : [
        {
          key: "carry",
          label: "Rosters carried over",
          done: f.carried,
          detail: f.carried ? undefined : "Bring last season's roster over",
          action: { kind: "open", place: "roster" },
        },
        {
          key: "retirements",
          label: "Retirements",
          done: f.retirementsWaiting === 0,
          detail:
            f.retirementsWaiting > 0 ? `${plural(f.retirementsWaiting, "player")} to look at` : undefined,
          action: { kind: "retirements" },
        },
        {
          key: "resign",
          label: "Re-signings",
          done: f.unsigned === 0,
          detail: f.unsigned > 0 ? `${plural(f.unsigned, "contract")} ran out` : undefined,
          action: { kind: "open", place: "roster" },
        },
      ];
  return [
    ...carried,
    {
      key: "free_agency",
      label: "Free agency",
      done: f.signings > 0,
      optional: true,
      detail: f.signings > 0 ? `${plural(f.signings, "signing")} logged` : undefined,
      action: { kind: "open", place: "transactions" },
    },
    {
      key: "draft",
      label: "Draft class",
      done: f.draftPicks > 0,
      detail: f.draftPicks > 0 ? plural(f.draftPicks, "pick") : "Every rookie, before week 1 names him",
      action: { kind: "capture", target: "draft_results" },
    },
    {
      key: "roster_page",
      label: "Roster page",
      done: f.rosterPage,
      action: { kind: "capture", target: "roster_page" },
    },
  ];
}

const preseason = (f: ChecklistFacts): ChecklistItem[] => [
  {
    key: "depth",
    label: "Depth chart",
    done: f.depthChart,
    detail: f.depthChart ? undefined : "Comes with the roster page, in its order",
    action: { kind: "open", place: "roster" },
  },
  {
    key: "goals",
    label: "Season goals",
    done: f.goals > 0,
    detail: f.goals > 0 ? plural(f.goals, "goal") : undefined,
    action: { kind: "open", place: "goals" },
  },
  {
    key: "preseason_report",
    label: "Pre-season report",
    done: f.prompts?.preseason.status === "answered",
    action: { kind: "open", place: "report" },
  },
];

const week = (f: ChecklistFacts): ChecklistItem[] => [
  {
    key: "game_log",
    label: "Game log",
    done: f.weekHasBoxScore,
    action: { kind: "capture", target: "game_log" },
  },
  {
    key: "standings",
    label: "Standings",
    done: f.regularGames > 0 && f.standingsGames >= f.regularGames,
    detail: f.regularGames > 0 ? `Through ${f.standingsGames} of ${f.regularGames} games` : undefined,
    action: { kind: "capture", target: "standings" },
  },
  {
    key: "weekly_awards",
    label: "Weekly awards",
    done: f.weekHasAwards,
    action: { kind: "capture", target: "weekly_awards" },
  },
];

function end(f: ChecklistFacts): ChecklistItem[] {
  const missing = RAW_STAT_CATEGORIES.filter((c) => !f.seasonStats.includes(c));
  return [
    {
      key: "season_stats",
      label: "Season stats",
      done: missing.length === 0,
      detail: missing.length
        ? `${missing.map((c) => STAT_CATEGORY_LABELS[c]).join(", ")} to shoot`
        : undefined,
      action: { kind: "capture", target: "season_player_stats" },
    },
    {
      key: "team_stats",
      label: "Team stats",
      done: f.teamStats,
      action: { kind: "capture", target: "team_season_stats" },
    },
    {
      key: "final_standings",
      label: "Final standings",
      done: f.standingsGames >= SEASON_GAMES,
      action: { kind: "capture", target: "standings" },
    },
    {
      key: "yearly_awards",
      label: "Awards",
      done: f.yearlyAwards > 0,
      action: { kind: "capture", target: "yearly_awards" },
    },
    {
      key: "playoffs",
      label: "Playoffs",
      done: f.playoffsSettled,
      action: { kind: "capture", target: "game_log" },
    },
    {
      key: "postseason_report",
      label: "Post-season report",
      done: f.prompts?.postseason.status === "answered",
      action: { kind: "open", place: "report" },
    },
  ];
}

export function seasonChecklist(facts: ChecklistFacts): ChecklistGroup[] {
  return [
    { key: "offseason", items: offseason(facts) },
    { key: "preseason", items: preseason(facts) },
    { key: "week", items: week(facts) },
    { key: "end", items: end(facts) },
  ];
}

export const isGroupDone = (group: ChecklistGroup) => group.items.every((i) => i.done || i.optional);

/** The group the season is in: the one Home opens. The offseason gives way once it is done. */
export function currentGroup(status: SeasonStatus, groups: readonly ChecklistGroup[]): ChecklistGroupKey {
  if (status === "regular") return "week";
  if (status === "postseason" || status === "complete") return "end";
  const offseasonGroup = groups.find((g) => g.key === "offseason");
  return offseasonGroup && isGroupDone(offseasonGroup) ? "preseason" : "offseason";
}

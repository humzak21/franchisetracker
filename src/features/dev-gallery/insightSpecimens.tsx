import { marginBars, pointsWeeks, streakBars } from "@shared/games/charts";
import { weekPoints } from "@shared/games/insights";
import { calendarEntries, type CalendarGame } from "@shared/games/seasonCalendar";
import type { WeekKey } from "@shared/domain";
import { DivergingBars } from "@/components/data/DivergingBars";
import { PointsChart } from "@/components/data/PointsChart";
import { RankTrend } from "@/components/data/RankTrend";
import { SeasonCalendar } from "@/components/data/SeasonCalendar";
import type { Specimen } from "./specimens";

/** The 2025 Patriots' first ten results: [week, opponent, home, us, them]. */
const RESULTS: [WeekKey, string, boolean, number, number][] = [
  ["w1", "LV", true, 13, 20],
  ["w2", "MIA", false, 33, 27],
  ["w3", "PIT", true, 14, 21],
  ["w4", "CAR", true, 42, 13],
  ["w5", "BUF", false, 23, 20],
  ["w6", "NO", false, 25, 19],
  ["w7", "TEN", false, 31, 13],
  ["w8", "CLE", true, 32, 13],
  ["w9", "ATL", true, 24, 23],
  ["w10", "TB", false, 28, 23],
];

const GAMES = RESULTS.map(([weekKey, , home, us, them]) => ({
  weekKey,
  status: "played" as const,
  userIsHome: home,
  homeScore: home ? us : them,
  awayScore: home ? them : us,
}));
const POINTS = weekPoints(GAMES).map((point, i) => ({ ...point, opponentAbbr: RESULTS[i]?.[1] }));

const CALENDAR: CalendarGame[] = [
  ...RESULTS.map(([weekKey, opponentAbbr, userIsHome, us, them]) => ({
    _id: weekKey,
    weekKey,
    status: "played" as const,
    result: us > them ? ("W" as const) : ("L" as const),
    us,
    them,
    userIsHome,
    opponentAbbr,
  })),
  {
    _id: "w11",
    weekKey: "w11",
    status: "scheduled",
    result: null,
    us: null,
    them: null,
    userIsHome: true,
    opponentAbbr: "NYJ",
  },
  {
    _id: "w14",
    weekKey: "w14",
    status: "bye",
    result: null,
    us: null,
    them: null,
    userIsHome: null,
    opponentAbbr: null,
  },
];

const TRENDS = [
  {
    key: "pointsPg",
    label: "Points per game",
    points: [
      { year: 2023, value: "13.9", rank: 30, tied: false },
      { year: 2024, value: "17.0", rank: 30, tied: true },
      { year: 2025, value: "28.8", rank: 2, tied: false },
    ],
  },
  {
    key: "pointsAllowedPg",
    label: "Points allowed per game",
    points: [
      { year: 2023, value: "21.5", rank: 14, tied: false },
      { year: 2024, value: "24.6", rank: 23, tied: false },
      { year: 2025, value: "18.8", rank: 4, tied: false },
    ],
  },
  {
    key: "takeaways",
    label: "Takeaways",
    points: [
      { year: 2024, value: "23", rank: null, tied: false },
      { year: 2025, value: "21", rank: 16, tied: false },
    ],
  },
];

export const INSIGHT_SPECIMENS: Specimen[] = [
  {
    id: "pointschart",
    name: "PointsChart",
    note: "The season pulse: scored and allowed by week. No grid and every other week labelled at phone width.",
    render: () => <PointsChart weeks={pointsWeeks(POINTS)} />,
  },
  {
    id: "divergingbars",
    name: "DivergingBars",
    note: "Margin of victory and the running streak: wins above zero, losses below.",
    render: () => (
      <div className="space-y-4">
        <DivergingBars points={marginBars(POINTS)} valueLabel="Margin of victory" />
        <DivergingBars points={streakBars(POINTS)} valueLabel="Streak" />
      </div>
    ),
  },
  {
    id: "ranktrend",
    name: "RankTrend",
    note: "Team rank ribbons across seasons: this season's ribbon, the move since last season, every season's rank.",
    render: () => <RankTrend rows={TRENDS} year={2025} />,
  },
  {
    id: "seasoncalendar",
    name: "SeasonCalendar",
    note: "Month grids with game days in result colors; a vertical list of game days per month at phone width.",
    render: () => <SeasonCalendar year={2025} entries={calendarEntries(2025, CALENDAR)} />,
  },
];

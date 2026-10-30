import { REGULAR_WEEKS } from "@shared/domain";
import { CountdownList } from "@/components/data/CountdownList";
import { CumulativeChart } from "@/components/data/CumulativeChart";
import { CoverageStrip } from "@/components/data/CoverageStrip";
import { DeltaBadge } from "@/components/data/DeltaBadge";
import { FactChip } from "@/components/data/FactChip";
import { PaceBar } from "@/components/data/PaceBar";
import { SeasonBars } from "@/components/data/SeasonBars";
import { CareerCurves, type CareerCurvesData } from "@/components/player/CareerCurves";
import { ScoreWorm, type WormPoint } from "@/components/data/ScoreWorm";
import { ScoringSummary, type SummaryPlay } from "@/components/data/ScoringSummary";
import { BUF, NE } from "./fixtures";
import type { Specimen } from "./specimens";

const CAREER: CareerCurvesData = {
  gamesPerSeason: 17,
  seasons: [
    { year: 2025, age: 23, gamesPlayed: 12, imported: true, totals: { recYds: 720, rec: 55, recTd: 4 } },
    { year: 2026, age: 24, gamesPlayed: 17, imported: false, totals: { recYds: 1140, rec: 88, recTd: 9 } },
    { year: 2027, age: 25, gamesPlayed: 4, imported: false, totals: { recYds: 312, rec: 22, recTd: 3 } },
  ],
  games: [2026, 2027].flatMap((year) =>
    Array.from({ length: year === 2026 ? 17 : 4 }, (_, i) => ({
      gameId: `${year}-${i}`,
      seasonId: String(year),
      year,
      weekKey: REGULAR_WEEKS[i] ?? "w1",
      stats: { recYds: 45 + ((i * 37) % 60), rec: 5 },
    })),
  ),
  records: [{ statKey: "recYds", value: 1402, year: 2024 }],
};

const when = (play: string, score: string) => ({ when: "Q2 9:14", what: play, score });

const WORM: WormPoint[] = [
  { seconds: 0, margin: 0, play: null },
  { seconds: 420, margin: 7, play: when("K. Boutte 15 yd pass from D. Maye", "0-7") },
  { seconds: 1140, margin: 0, play: when("J. Cook 4 yd run", "7-7") },
  { seconds: 1780, margin: -3, play: when("T. Bass 41 yd field goal", "10-7") },
  { seconds: 3240, margin: 4, play: when("T. Henderson 21 yd run", "10-14") },
  { seconds: 3600, margin: 4, play: null },
];

const PLAY: Omit<SummaryPlay, "id" | "period" | "clock" | "team" | "description" | "score"> = {
  printed: null,
  pat: "kick",
  gameWinner: false,
  needsPlayer: false,
  suggestion: null,
};

const PLAYS: SummaryPlay[] = [
  {
    ...PLAY,
    id: "1",
    period: 1,
    clock: 480,
    team: NE,
    description: "15 yd pass from D. Maye",
    score: "0-7",
    needsPlayer: true,
    suggestion: "K. Boutte",
  },
  { ...PLAY, id: "2", period: 2, clock: 360, team: BUF, description: "J. Cook 4 yd run", score: "7-7" },
  {
    ...PLAY,
    id: "3",
    period: 2,
    clock: 20,
    team: BUF,
    description: "T. Bass 41 yd field goal",
    score: "10-7",
    pat: null,
  },
  {
    ...PLAY,
    id: "4",
    period: 4,
    clock: 134,
    team: NE,
    description: "T. Henderson 21 yd run",
    score: "10-14",
    pat: "kick_failed",
    gameWinner: true,
  },
];

export const STATS_SPECIMENS: Specimen[] = [
  {
    id: "coveragestrip",
    name: "CoverageStrip",
    note: "How much of a season has been captured, one count per kind of screen. A full bar turns green.",
    render: () => (
      <CoverageStrip
        items={[
          { key: "box", label: "Box scores", have: 9, of: 9 },
          { key: "team", label: "Team stats", have: 7, of: 9 },
          { key: "scoring", label: "Scoring", have: 0, of: 9 },
          { key: "standings", label: "Standings", have: 8, of: 9 },
          { key: "awards", label: "Weekly awards", have: 3, of: 9 },
        ]}
      />
    ),
  },
  {
    id: "deltabadge",
    name: "DeltaBadge",
    note: "A signed change, coloured by whether it is good for that stat. A short season shows it without a verdict.",
    render: () => (
      <div className="flex flex-wrap items-baseline gap-4">
        <DeltaBadge delta={214} />
        <DeltaBadge delta={-41} />
        <DeltaBadge delta={-3} better="lower" />
        <DeltaBadge delta={0} />
        <DeltaBadge delta={120} muted />
        <DeltaBadge delta={null} />
      </div>
    ),
  },
  {
    id: "pacebar",
    name: "PaceBar",
    note: "Progress to a target with the projected finish as a ghost. Reading and label stack in a narrow pane.",
    render: () => (
      <div className="space-y-4">
        <PaceBar
          label="Receiving yards: franchise record"
          accessibleLabel="Receiving yards, franchise record"
          value={812}
          target={1402}
          projected={1228}
          reading="812 of 1,402"
          caption="On pace for 1,228 · 65.6 a game to get there"
        />
        <PaceBar
          label="Rushing yards: next mark"
          accessibleLabel="Rushing yards, next mark"
          value={942}
          target={1000}
          reading="942 of 1,000"
        />
      </div>
    ),
  },
  {
    id: "countdownlist",
    name: "CountdownList",
    note: "The roster's nearest career marks, ranked in games away at each player's own rate.",
    render: () => (
      <CountdownList
        items={[
          {
            statKey: "passYds",
            mark: 10000,
            value: 9813,
            remaining: 187,
            gamesAway: 1,
            player: { playerId: "maye", name: "Drake Maye", position: "QB", headshotUrl: null },
          },
          {
            statKey: "recTd",
            mark: 25,
            value: 22,
            remaining: 3,
            gamesAway: 4,
            player: { playerId: "diggs", name: "Stefon Diggs", position: "WR", headshotUrl: null },
          },
        ]}
      />
    ),
  },
  {
    id: "cumulativechart",
    name: "CumulativeChart",
    note: "Running totals by game: seasons as step lines, a record's pace dashed, marks as rules. Legend as chips.",
    render: () => (
      <CumulativeChart
        valueLabel="Receiving yards"
        marks={[1000]}
        series={[
          {
            key: "y27",
            label: "2027",
            points: [62, 141, 201, 312].map((total, i) => ({ game: i + 1, total })),
          },
          {
            key: "y26",
            label: "2026",
            points: [48, 90, 171, 240, 330, 391, 470].map((total, i) => ({ game: i + 1, total })),
          },
          {
            key: "record",
            label: "Record pace (2024)",
            reference: true,
            points: [1, 7].map((game) => ({ game, total: game * 82 })),
          },
        ]}
      />
    ),
  },
  {
    id: "seasonbars",
    name: "SeasonBars",
    note: "Grouped bars per season, with a rank badge under each year where one was captured.",
    render: () => (
      <SeasonBars
        valueLabel="Points scored and allowed"
        series={[
          { key: "pf", label: "Scored" },
          { key: "pa", label: "Allowed" },
        ]}
        seasons={[
          { year: 2026, values: { pf: 412, pa: 301 }, rank: 6 },
          { year: 2027, values: { pf: 356, pa: 340 }, rank: 14 },
          { year: 2028, values: { pf: 471, pa: 288 }, rank: 2 },
        ]}
      />
    ),
  },
  {
    id: "careercurves",
    name: "CareerCurves",
    note: "A stat by season with each change, then running totals against the last season, the best and the record.",
    render: () => <CareerCurves data={CAREER} initialStat="recYds" />,
  },
  {
    id: "factchip",
    name: "FactChip",
    note: "Streaks and records held. Still-running streaks and held records light up in the team accent.",
    render: () => (
      <div className="flex flex-wrap gap-2">
        <FactChip value={5} label="Games with a TD pass" detail="Longest 5" active />
        <FactChip value={342} label="Passing yards" detail="Franchise record · single game · 2026" active />
        <FactChip value={0} label="100-yard receiving games" detail="Longest 2" />
      </div>
    ),
  },
  {
    id: "scoreworm",
    name: "ScoreWorm",
    note: "The margin over game time, stepping at each score. Shorter from its own width on a phone; tap a score.",
    render: () => (
      <ScoreWorm
        points={WORM}
        periods={[0, 1, 2, 3].map((i) => ({ start: i * 900, end: (i + 1) * 900 }))}
        periodLabel={(i) => `Q${i + 1}`}
        label="Patriots lead over the game"
      />
    ),
  },
  {
    id: "scoringsummary",
    name: "ScoringSummary",
    note: "Every score by period. A play missing a name says so and offers who it can only be.",
    render: () => <ScoringSummary plays={PLAYS} onPick={() => undefined} onAssign={() => undefined} />,
  },
];

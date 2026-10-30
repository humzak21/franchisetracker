import { FactChip } from "@/components/data/FactChip";
import { ScoreWorm, type WormPoint } from "@/components/data/ScoreWorm";
import { ScoringSummary, type SummaryPlay } from "@/components/data/ScoringSummary";
import { BUF, NE } from "./fixtures";
import type { Specimen } from "./specimens";

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

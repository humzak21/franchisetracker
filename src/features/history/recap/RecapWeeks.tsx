import { Link } from "@tanstack/react-router";
import { weekLabel } from "@shared/domain";
import { marginBars } from "@shared/games/charts";
import { DivergingBars } from "@/components/data/DivergingBars";
import { Tile } from "@/components/data/Tile";
import { Section } from "@/components/layout/Section";
import type { Recap } from "./types";

type High = Recap["highs"]["bestWin"];

function HighTile({ label, game }: { label: string; game: High }) {
  if (!game) return <Tile label={label} value="—" />;
  const where = [weekLabel(game.weekKey), game.opponentAbbr].filter(Boolean).join(" · ");
  return (
    <Link to="/games/$gameId" params={{ gameId: game.gameId }} className="block rounded-xl hover:opacity-90">
      <Tile label={label} value={`${game.us}-${game.them}`} detail={where} />
    </Link>
  );
}

/** How the year went week to week: every margin, then its best and worst. */
export function RecapWeeks({ recap }: { recap: Recap }) {
  const { weeks, highs } = recap;
  return (
    <Section title="Week by week">
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <DivergingBars points={marginBars(weeks)} valueLabel="Margin of victory" />
        </div>
        <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-4">
          <HighTile label="Biggest win" game={highs.bestWin} />
          <HighTile label="Worst loss" game={highs.worstLoss} />
          <Tile label="Win run" value={highs.longestWin} detail="Longest" />
          <Tile label="Losing run" value={highs.longestLoss} detail="Longest" />
        </div>
      </div>
    </Section>
  );
}

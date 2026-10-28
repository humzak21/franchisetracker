import { CLINCH_LABELS, type Clinch } from "@shared/league/projection";

const MARKS: Clinch[] = ["z", "y", "x"];

/** What the tints and letters on the standings mean, and whether the seeds are final. */
export function StandingsLegend({ final }: { final: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-win" /> First-round bye
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-warn" /> Wild card
      </span>
      {MARKS.map((mark) => (
        <span key={mark}>
          <b className="text-foreground">{mark}</b> {CLINCH_LABELS[mark].replace("Clinched ", "")}
        </span>
      ))}
      {!final && <span className="text-subtle-foreground">Seeds as if the season ended today</span>}
    </p>
  );
}

import { TROPHY_KINDS, TROPHY_LABELS, type TrophyKind, type TrophyYear } from "@shared/history/trophies";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

const emphasis: Record<TrophyKind, string> = {
  superBowl: "bg-elite-2 text-elite-2-foreground",
  conference: "bg-elite-1 text-primary",
  division: "bg-surface-2 text-foreground",
  playoffs: "bg-surface-2 text-muted-foreground",
};

function YearChip({ trophy, kind }: { trophy: TrophyYear; kind: TrophyKind }) {
  const chip = (
    <span
      className={cn(
        "num inline-flex h-7 items-center rounded-md px-2 text-[13px] font-semibold",
        trophy.source === "history"
          ? "border border-dashed border-border-strong text-muted-foreground"
          : emphasis[kind],
      )}
    >
      {trophy.year}
    </span>
  );
  return trophy.source === "history" ? <Tooltip content="Before the franchise">{chip}</Tooltip> : chip;
}

/** Trophy counts with every year, franchise-era titles solid and real-history titles outlined. */
export function TrophyRoom({ room }: { room: Record<TrophyKind, TrophyYear[]> }) {
  return (
    <div className="@container grid grid-cols-1 gap-3 @tablet:grid-cols-2">
      {TROPHY_KINDS.map((kind) => (
        <article key={kind} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {TROPHY_LABELS[kind].title}
            </h3>
            <span
              className={cn(
                "num font-display text-4xl leading-none font-bold",
                kind === "superBowl" && "text-primary",
              )}
            >
              {room[kind].length}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {room[kind].length === 0 ? (
              <span className="text-sm text-subtle-foreground">None yet</span>
            ) : (
              room[kind].map((trophy) => (
                <YearChip key={`${trophy.year}-${trophy.source}`} trophy={trophy} kind={kind} />
              ))
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

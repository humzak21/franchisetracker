import { Flag, Trophy } from "lucide-react";
import type { ReactElement } from "react";
import { superBowlName } from "@shared/history/seasonRecord";
import { TROPHY_LABELS, type TrophyKind, type TrophyYear } from "@shared/history/trophies";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type Room = Record<TrophyKind, TrophyYear[]>;

const BEFORE = "Before the franchise";

/** The tier-2 glow elite stats get, so titles read as the team's best moments. */
const GLOW = "shadow-[0_0_0_1px_var(--team-accent),0_0_18px_-4px_var(--team-accent)]";

/** Franchise titles in the team accent; real history before it in the softer accent wash. */
const banner = (trophy: TrophyYear) =>
  trophy.source === "franchise"
    ? cn("bg-elite-2 text-elite-2-foreground", GLOW)
    : "border border-primary/50 bg-elite-1 text-foreground";

function Before({ trophy, children }: { trophy: TrophyYear; children: ReactElement }) {
  return trophy.source === "history" ? <Tooltip content={BEFORE}>{children}</Tooltip> : children;
}

/** One championship: the Super Bowl's numeral large, the season it closed under it. */
function SuperBowlBanner({ trophy }: { trophy: TrophyYear }) {
  const name = superBowlName(trophy.year);
  const numeral = name?.replace("Super Bowl ", "");
  return (
    <Before trophy={trophy}>
      <div
        className={cn(
          "flex min-w-24 flex-col items-center rounded-lg px-4 pt-2 pb-2.5 text-center",
          banner(trophy),
        )}
      >
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase opacity-80">
          {name ? "Super Bowl" : "NFL title"}
        </span>
        <span className="font-display text-4xl leading-none font-bold">{numeral ?? trophy.year}</span>
        {name && <span className="num mt-1 text-xs font-semibold opacity-80">{trophy.year}</span>}
      </div>
    </Before>
  );
}

/** One division title, hung like a pennant. */
function DivisionPennant({ trophy }: { trophy: TrophyYear }) {
  return (
    <Before trophy={trophy}>
      <span
        className={cn(
          "num inline-flex h-10 items-center rounded-md px-3 font-display text-xl font-bold",
          banner(trophy),
        )}
      >
        {trophy.year}
      </span>
    </Before>
  );
}

function YearChip({ trophy }: { trophy: TrophyYear }) {
  return (
    <Before trophy={trophy}>
      <span
        className={cn(
          "num inline-flex h-7 items-center rounded-md px-2 text-[13px] font-semibold",
          trophy.source === "history"
            ? "border border-dashed border-border-strong text-muted-foreground"
            : "bg-surface-2 text-foreground",
        )}
      >
        {trophy.year}
      </span>
    </Before>
  );
}

function Heading({ kind, count, big }: { kind: TrophyKind; count: number; big?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", big ? "items-center" : "items-baseline")}>
      <h3
        className={cn(
          "font-semibold tracking-[0.08em] uppercase",
          big ? "font-display text-lg text-foreground" : "text-[11px] text-subtle-foreground",
        )}
      >
        {TROPHY_LABELS[kind].title}
      </h3>
      <span
        className={cn("num font-display leading-none font-bold", big ? "text-6xl text-primary" : "text-4xl")}
      >
        {count}
      </span>
    </div>
  );
}

const none = <span className="text-sm text-subtle-foreground">None yet</span>;

/**
 * The trophy room: Super Bowls first and largest (named by the season they closed), division
 * titles as pennants, then conference titles and playoff trips. Franchise titles glow in the team
 * accent; real history from before the franchise is the softer wash.
 */
export function TrophyRoom({ room }: { room: Room }) {
  return (
    <div className="@container space-y-3">
      <article className="relative overflow-hidden rounded-xl border border-primary/40 bg-surface p-5">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top_right,var(--elite-1),transparent_65%)]"
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <Trophy className="size-7 text-primary" strokeWidth={1.75} />
            <div className="flex-1">
              <Heading kind="superBowl" count={room.superBowl.length} big />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {room.superBowl.length === 0
              ? none
              : room.superBowl.map((t) => <SuperBowlBanner key={`${t.year}-${t.source}`} trophy={t} />)}
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-primary/25 bg-surface p-5">
        <div className="flex items-center gap-3">
          <Flag className="size-6 text-primary" strokeWidth={1.75} />
          <div className="flex-1">
            <Heading kind="division" count={room.division.length} big />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {room.division.length === 0
            ? none
            : room.division.map((t) => <DivisionPennant key={`${t.year}-${t.source}`} trophy={t} />)}
        </div>
      </article>

      <div className="grid grid-cols-1 gap-3 @tablet:grid-cols-2">
        {(["conference", "playoffs"] as const).map((kind) => (
          <article key={kind} className="rounded-xl border border-border bg-surface p-4">
            <Heading kind={kind} count={room[kind].length} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {room[kind].length === 0
                ? none
                : room[kind].map((t) => <YearChip key={`${t.year}-${t.source}`} trophy={t} />)}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

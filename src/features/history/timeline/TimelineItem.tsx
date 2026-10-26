import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeftRight, Landmark, Medal, NotebookPen, Trophy, type LucideIcon } from "lucide-react";
import type { api } from "@convex/_generated/api";
import type { TimelineKind } from "@shared/history/timeline";
import { cn } from "@/lib/cn";

type Entry = FunctionReturnType<typeof api.history.timeline.list>["entries"][number];

const ICONS: Record<TimelineKind, LucideIcon> = {
  game: Trophy,
  season: NotebookPen,
  transaction: ArrowLeftRight,
  award: Medal,
  hof: Landmark,
};

const RESULT_TONE = { W: "text-win", L: "text-loss", T: "text-tie" } as const;

/** One moment in the story: a dot on the rail, when it happened, the headline and the note. */
export function TimelineItem({ entry }: { entry: Entry }) {
  const Icon = ICONS[entry.kind];
  const title = (
    <span className={cn("font-semibold", entry.result && RESULT_TONE[entry.result])}>{entry.title}</span>
  );
  return (
    <li className="relative">
      <span className="absolute top-3 -left-[31px] flex size-5 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
        <Icon className="size-3" />
      </span>
      <div className="rounded-xl border border-border bg-surface px-4 py-3">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
          {entry.when}
        </div>
        <div className="mt-0.5 text-[15px]">
          {entry.gameId ? (
            <Link
              to="/games/$gameId"
              params={{ gameId: entry.gameId }}
              className="hover:underline pointer-coarse:touch-target"
            >
              {title}
            </Link>
          ) : entry.playerId ? (
            <Link
              to="/players/$playerId"
              params={{ playerId: entry.playerId }}
              className="hover:underline pointer-coarse:touch-target"
            >
              {title}
            </Link>
          ) : entry.kind === "season" ? (
            <Link
              to="/history/reports/$year"
              params={{ year: String(entry.year) }}
              className="hover:underline pointer-coarse:touch-target"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </div>
        {entry.body && (
          <p className="mt-1.5 text-sm whitespace-pre-line text-muted-foreground">{entry.body}</p>
        )}
      </div>
    </li>
  );
}

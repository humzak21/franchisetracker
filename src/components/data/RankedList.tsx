import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type RankedItem = {
  key: string;
  /** Left out on a list that is not a ranking. */
  rank?: number;
  name: ReactNode;
  /** Makes the name a link to the player. */
  playerId?: string;
  /** Sits after the name: an edit button, a position. */
  nameEnd?: ReactNode;
  detail?: ReactNode;
  /** Makes the detail a link to the box score. */
  gameId?: string;
  value: ReactNode;
  /** The user's own row on a league-wide list. */
  marked?: boolean;
  /** Draws the row as a bar: its share of the longest, 0 to 1. */
  share?: number;
};

type RankedListProps = {
  title: string;
  /** What the list is to a screen reader: "Passing yards records". */
  label: string;
  items: readonly RankedItem[];
  footer?: ReactNode;
};

/** One titled list of ranked rows: the records, leaders and streaks lists, first place lit. */
export function RankedList({ title, label, items, footer }: RankedListProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label={label}>
      <h4 className="border-b border-border px-4 py-2.5 text-sm font-medium">{title}</h4>
      <ol className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.key}
            className={cn("flex min-h-11 items-center gap-2.5 px-3 py-1.5", item.marked && "bg-elite-1")}
          >
            {item.rank !== undefined && (
              <span
                className={cn(
                  "num w-5 shrink-0 text-right font-display text-base font-bold",
                  item.rank === 1 ? "text-primary" : "text-subtle-foreground",
                )}
              >
                {item.rank}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                {item.playerId ? (
                  <Link
                    to="/players/$playerId"
                    params={{ playerId: item.playerId }}
                    className="truncate hover:underline pointer-coarse:touch-target"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <span className="truncate">{item.name}</span>
                )}
                {item.nameEnd}
              </span>
              {item.detail !== undefined && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {item.gameId ? (
                    <Link
                      to="/games/$gameId"
                      params={{ gameId: item.gameId }}
                      className="flex min-w-0 items-center gap-1.5 hover:underline"
                    >
                      {item.detail}
                    </Link>
                  ) : (
                    item.detail
                  )}
                </span>
              )}
              {item.share !== undefined && (
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(item.share * 100)}%` }}
                  />
                </span>
              )}
            </span>
            <span className={cn("num shrink-0 text-sm font-semibold", item.rank === 1 && "text-primary")}>
              {item.value}
            </span>
          </li>
        ))}
      </ol>
      {footer && (
        <div className="border-t border-border px-4 py-2 text-xs text-subtle-foreground">{footer}</div>
      )}
    </section>
  );
}

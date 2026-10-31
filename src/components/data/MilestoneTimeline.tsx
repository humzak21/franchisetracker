import { Link } from "@tanstack/react-router";
import type { MilestoneKind } from "@shared/domain";
import { MILESTONE_ICONS } from "./milestoneIcons";

export type TimelineEntry = {
  key: string;
  kind: MilestoneKind;
  title: string;
  detail?: string | null;
  /** "2029 W9". */
  when: string;
  gameId?: string | null;
};

/** What happened and when, newest first, each with a link to its game. */
export function MilestoneTimeline({ items }: { items: readonly TimelineEntry[] }) {
  return (
    <ol className="space-y-0.5">
      {items.map((item, i) => {
        const Icon = MILESTONE_ICONS[item.kind];
        return (
          <li key={item.key} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-elite-1 text-primary ring-1 ring-primary/20">
                <Icon aria-hidden className="size-3.5" />
              </span>
              {i < items.length - 1 && <span aria-hidden className="w-px flex-1 bg-border" />}
            </span>
            <span className="min-w-0 flex-1 pb-3">
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block text-xs text-muted-foreground">
                {item.gameId ? (
                  <Link to="/games/$gameId" params={{ gameId: item.gameId }} className="hover:underline">
                    {item.when}
                  </Link>
                ) : (
                  item.when
                )}
                {item.detail ? ` · ${item.detail}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

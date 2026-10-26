import { useCallback, useState, type ReactNode } from "react";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { useElementWidth } from "@/lib/hooks/useElementWidth";
import { useSwipe } from "@/lib/hooks/useSwipe";

export type Pane = { id: string; label: string; content: ReactNode };

type SplitPaneProps = {
  /** Two (or three) panes, left to right on wide screens. */
  panes: readonly [Pane, Pane, ...Pane[]];
  /** Grid template for wide layout, e.g. "3fr 2fr". */
  ratio?: string;
  className?: string;
};

/**
 * Side-by-side panes (game detail, review, compare). Under 640 px of its own width it becomes
 * one pane at a time with a segmented control, and swiping moves between panes.
 */
export function SplitPane({ panes, ratio, className }: SplitPaneProps) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState(panes[0].id);
  const index = Math.max(
    panes.findIndex((p) => p.id === active),
    0,
  );

  const go = useCallback(
    (delta: number) => {
      const next = panes[index + delta];
      if (next) setActive(next.id);
    },
    [panes, index],
  );
  useSwipe(ref, { onSwipeLeft: () => go(1), onSwipeRight: () => go(-1) });

  return (
    <div ref={ref} className={cn("min-w-0", className)}>
      {compact ? (
        <>
          <Segmented
            className="mb-3 flex w-full"
            value={panes[index]!.id}
            onChange={setActive}
            options={panes.map((p) => ({ value: p.id, label: p.label }))}
            aria-label="Pane"
          />
          <div key={panes[index]!.id} className="animate-fade-in">
            {panes[index]!.content}
          </div>
        </>
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: ratio ?? `repeat(${panes.length}, minmax(0, 1fr))` }}
        >
          {panes.map((pane) => (
            <div key={pane.id} className="min-w-0">
              {pane.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

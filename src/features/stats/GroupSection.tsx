import type { ReactNode } from "react";
import type { StatGroup } from "@shared/stats";

/** The page anchor for a position group's table, for the jump links above them. */
export const groupAnchor = (scope: string, group: StatGroup) => `${scope}-${group.id}`;

/** One position group's table on a page of them all: a heading the jump links point at. */
export function GroupSection({ id, group, children }: { id: string; group: StatGroup; children: ReactNode }) {
  return (
    <section id={id} aria-label={group.label} className="scroll-mt-32 space-y-2">
      <h3 className="font-display text-base leading-tight font-semibold tracking-wide uppercase">
        {group.label}
      </h3>
      {children}
    </section>
  );
}

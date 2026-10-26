import type { ReactNode } from "react";
import { getStat, type StatKey, type ThresholdOverrides } from "@shared/stats";
import { cn } from "@/lib/cn";
import { Sparkline } from "./Sparkline";
import { StatCell } from "./StatCell";

export type StatCardItem = { stat: StatKey; value: number | null; trend?: readonly (number | null)[] };
export type StatCardGroup = { title: string; items: readonly StatCardItem[] };

type StatCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  groups: readonly StatCardGroup[];
  highlight?: boolean;
  thresholds?: ThresholdOverrides;
  footer?: ReactNode;
  className?: string;
};

/** Per-entity stats as a card grouped by category; used instead of wide rows on phones. */
export function StatCard({
  title,
  subtitle,
  groups,
  highlight = true,
  thresholds,
  footer,
  className,
}: StatCardProps) {
  return (
    <article className={cn("@container rounded-xl border border-border bg-surface", className)}>
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-display text-lg leading-none font-semibold tracking-wide uppercase">{title}</h3>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </header>
      <div className="divide-y divide-border">
        {groups.map((group) => (
          <section key={group.title} className="px-4 py-3">
            <h4 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {group.title}
            </h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 @md:grid-cols-3 @2xl:grid-cols-4">
              {group.items.map((item) => {
                const def = getStat(item.stat);
                return (
                  <div key={item.stat} className="min-w-0">
                    <dt className="truncate text-xs text-muted-foreground" title={def.label}>
                      {def.label}
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-2 text-[15px] font-semibold">
                      <StatCell
                        stat={item.stat}
                        value={item.value}
                        highlight={highlight}
                        thresholds={thresholds}
                      />
                      {item.trend && (
                        <Sparkline values={item.trend} width={52} height={18} area={false} markMax={false} />
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
      {footer && (
        <footer className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">{footer}</footer>
      )}
    </article>
  );
}

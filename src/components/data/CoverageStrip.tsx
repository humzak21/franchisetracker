import { cn } from "@/lib/cn";

type CoverageItem = { key: string; label: string; have: number; of: number };

/** How much of a season has been captured: a count and a thin bar per kind of screen. */
export function CoverageStrip({ items, className }: { items: readonly CoverageItem[]; className?: string }) {
  return (
    <div className={cn("@container", className)}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 @lg:grid-cols-5">
        {items.map(({ key, label, have, of }) => (
          <div key={key} className="min-w-0">
            <dt className="truncate text-[11px] text-subtle-foreground">{label}</dt>
            <dd className="num text-sm font-semibold">
              {have}
              <span className="font-normal text-muted-foreground"> / {of}</span>
            </dd>
            <div aria-hidden className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full", of > 0 && have >= of ? "bg-win" : "bg-primary")}
                style={{ width: of > 0 ? `${Math.min(have / of, 1) * 100}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = {
  title?: string;
  description?: ReactNode;
  /** Anchor id for section jump links on long pages. */
  id?: string;
  actions?: ReactNode;
  /** `card` wraps the body in a surface; `plain` leaves it bare (for tables and grids that bring their own). */
  variant?: "card" | "plain";
  children: ReactNode;
  className?: string;
};

export function Section({
  title,
  description,
  id,
  actions,
  variant = "plain",
  children,
  className,
}: SectionProps) {
  return (
    <section id={id} className={cn("animate-rise-in scroll-mt-20", className)}>
      {(title || actions) && (
        // Actions wrap under the title when both do not fit, so a phone never squeezes the description.
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="min-w-48 flex-1">
            {title && (
              <h2 className="font-display text-lg leading-tight font-semibold tracking-wide uppercase">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex max-w-full shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {variant === "card" ? (
        <div className="rounded-xl border border-border bg-surface p-4">{children}</div>
      ) : (
        children
      )}
    </section>
  );
}

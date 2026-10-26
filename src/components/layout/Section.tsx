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
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-lg leading-tight font-semibold tracking-wide uppercase">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
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

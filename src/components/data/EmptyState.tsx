import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** `inline` sits inside a section; `page` fills a screen. */
  size?: "inline" | "page";
  className?: string;
};

/** Intentional empty state: field-line backdrop, team-tinted icon, one clear next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "inline",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong text-center",
        size === "page" ? "min-h-[50dvh] px-6 py-16" : "px-5 py-10",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [background-image:repeating-linear-gradient(90deg,var(--border)_0_1px,transparent_1px_56px)] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] opacity-[0.5]"
      />
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-elite-1 text-primary ring-1 ring-primary/20">
        <Icon className="size-6" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-xl font-semibold tracking-wide uppercase">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

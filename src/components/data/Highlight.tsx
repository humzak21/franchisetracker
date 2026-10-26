import type { ReactNode } from "react";
import type { Tier } from "@shared/stats";
import { cn } from "@/lib/cn";

/** Tier styling shared by StatCell, StatCard and anything else that marks elite numbers. */
export const tierClass: Record<Tier, string> = {
  0: "",
  1: "bg-elite-1 text-primary font-semibold",
  2: "bg-elite-2 text-elite-2-foreground font-bold shadow-[0_0_0_1px_var(--team-accent),0_0_14px_-2px_var(--team-accent)]",
};

/** Wraps a value in its elite tier treatment. Tier 0 renders children untouched. */
export function Highlight({
  tier,
  children,
  className,
  title,
}: {
  tier: Tier;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  if (tier === 0) return <>{children}</>;
  return (
    <span
      title={title}
      className={cn("num inline-flex items-center rounded-[5px] px-1.5 py-px", tierClass[tier], className)}
    >
      {children}
    </span>
  );
}

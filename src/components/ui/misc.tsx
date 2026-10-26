/** Small presentational primitives: Badge, Kbd, Skeleton. */
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-none font-semibold tracking-wide uppercase",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted-foreground",
        accent: "bg-elite-1 text-primary",
        solid: "bg-primary text-primary-foreground",
        win: "bg-win/15 text-win",
        loss: "bg-loss/15 text-loss",
        tie: "bg-tie/15 text-tie",
        ot: "bg-ot/15 text-ot",
        warn: "bg-warn/15 text-warn",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-strong bg-surface-2 px-1 font-sans text-[11px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-2", className)} {...props} />;
}

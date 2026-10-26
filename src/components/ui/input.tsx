import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-surface px-3 text-sm text-foreground transition-colors placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:outline-none pointer-coarse:h-11 pointer-coarse:text-base",
        className,
      )}
      {...props}
    />
  );
}

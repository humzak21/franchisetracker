import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Multi-line text styled like `Input`; 16 px text on touch so iOS does not zoom into it. */
export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full resize-y rounded-lg border border-input bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-foreground placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:outline-none sm:text-sm pointer-coarse:text-base",
        className,
      )}
      {...props}
    />
  );
}

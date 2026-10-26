import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "shadow-elevated z-50 max-h-[min(70dvh,32rem)] w-72 overflow-y-auto rounded-xl border border-border-strong bg-surface p-3 outline-none data-[state=open]:animate-rise-in",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

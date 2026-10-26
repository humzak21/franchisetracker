import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Bottom sheet for phone-sized choices (pickers, toolbars, the More menu). Drag to dismiss.
 * On wide screens it stays a bottom sheet but is width-capped and centered.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-2xl border border-b-0 border-border-strong bg-surface outline-none",
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-surface-3" />
          <div className="px-5 pt-3 pb-2">
            <Drawer.Title className="font-display text-xl font-semibold tracking-wide uppercase">
              {title}
            </Drawer.Title>
            <Drawer.Description className={description ? "mt-0.5 text-sm text-muted-foreground" : "sr-only"}>
              {description ?? title}
            </Drawer.Description>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
          <div className="pb-safe" />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

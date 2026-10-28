import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type ActionMenuItem = { id: string; label: string; icon: LucideIcon; onSelect: () => void };

/**
 * A short list of actions behind one button: a table row's actions, or a page's less common ones.
 * `trigger` is the button (a Button works); choosing an item closes the menu first.
 */
export function ActionMenu({
  trigger,
  label,
  items,
}: {
  trigger: ReactNode;
  /** Names the list for screen readers, e.g. "Actions for Drake Maye". */
  label: string;
  items: readonly ActionMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <ul className="space-y-0.5">
          {items.map(({ id, label: text, icon: Icon, onSelect }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none pointer-coarse:h-11 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
              >
                <Icon aria-hidden />
                {text}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

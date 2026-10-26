import { Command } from "cmdk";
import type { ReactNode } from "react";

type PaletteItemProps = {
  onSelect: () => void;
  icon: ReactNode;
  children: ReactNode;
  hint?: string;
  /** Matched against the search besides the text; server results pass the search itself. */
  keywords?: string[];
  value?: string;
};

/** One row of the command palette. */
export function PaletteItem({ onSelect, icon, children, hint, keywords, value }: PaletteItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      keywords={keywords}
      value={value}
      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted-foreground"
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="truncate text-xs text-subtle-foreground">{hint}</span>}
    </Command.Item>
  );
}

export const paletteGroupClass =
  "px-1.5 pb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-subtle-foreground [&_[cmdk-group-heading]]:uppercase";

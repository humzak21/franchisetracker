import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

type PickerGroupProps = {
  label: string;
  searching: boolean;
  /** Shown in place of the list once a search came back with nothing. */
  empty: string;
  /** Number of options; the group keeps its line while empty so the sheet does not jump. */
  count: number;
  children: ReactNode;
};

/** A labelled list of search results in a player picker, with its own searching and empty state. */
export function PickerGroup({ label, searching, empty, count, children }: PickerGroupProps) {
  return (
    <section aria-label={label} aria-busy={searching} className="space-y-1">
      <h4 className="flex items-center gap-2 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
        {searching && <LoaderCircle aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />}
      </h4>
      {count > 0 ? (
        <ul className="space-y-1">{children}</ul>
      ) : (
        <p className="flex min-h-12 items-center px-3 text-sm text-subtle-foreground">
          {searching ? "Searching…" : empty}
        </p>
      )}
    </section>
  );
}

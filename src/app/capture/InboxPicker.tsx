import { Check, Images } from "lucide-react";
import { api } from "@convex/_generated/api";
import { INGESTION_TARGETS, isTargetKey } from "@shared/ingestion/targets";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { cn } from "@/lib/cn";
import { formatAge } from "@/lib/time";
import { attachableSets } from "./inboxChoices";

type InboxPickerProps = {
  selected: readonly string[];
  onChange: (setKeys: string[]) => void;
};

const labelClass = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

/**
 * Screenshots already in the inbox, for a game's import sheet: tap sets to attach them to the
 * game. Untagged sets come first; committed or extracting ones are not offered.
 */
export function InboxPicker({ selected, onChange }: InboxPickerProps) {
  const inbox = useQuery(api.ingestion.inbox.list, {});
  if (inbox === undefined) return <Skeleton className="h-24 rounded-xl" />;
  const sets = attachableSets(inbox);
  if (sets.length === 0) return null;
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <div className="space-y-1.5">
      <span className={labelClass}>From the inbox</span>
      <ul
        aria-label="Inbox screenshots"
        className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2"
      >
        {sets.map((set) => {
          const on = selected.includes(set.setKey);
          const cover = set.images[0]?.url;
          const what =
            set.targetKey && isTargetKey(set.targetKey) ? INGESTION_TARGETS[set.targetKey].label : "Untagged";
          return (
            <li key={set.setKey}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${what}, ${set.images.length} screenshot${set.images.length === 1 ? "" : "s"}, ${formatAge(set.createdAt)}`}
                onClick={() => toggle(set.setKey)}
                className={cn(
                  "relative block w-full overflow-hidden rounded-lg border text-left transition-colors",
                  on ? "border-primary ring-2 ring-primary" : "border-border hover:border-border-strong",
                )}
              >
                <span className="block aspect-[4/3] bg-surface-2">
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <Images className="m-auto mt-6 size-6 text-muted-foreground" />
                  )}
                </span>
                <span className="block truncate px-2 py-1 text-[11px] text-muted-foreground">
                  {what} · {formatAge(set.createdAt)}
                </span>
                {set.images.length > 1 && (
                  <span className="num absolute top-1 left-1 rounded bg-black/60 px-1.5 text-[11px] text-white">
                    {set.images.length}
                  </span>
                )}
                {on && (
                  <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { api } from "@convex/_generated/api";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/convex/useQuery";

/** Inbox sets waiting on the user; the only nav item with a count today. */
export function useNavCount(id: string): number {
  const pending = useQuery(api.ingestion.inbox.pendingCount, id === "inbox" ? {} : "skip");
  return pending ?? 0;
}

/** A count pill beside a nav label, or a dot where there is no room for a number. */
export function NavBadge({
  count,
  dot = false,
  className,
}: {
  count: number;
  dot?: boolean;
  className?: string;
}) {
  if (count === 0) return null;
  return dot ? (
    // A dot sits on an icon whose label already names the screen; the count is in the sheet or sidebar.
    <span aria-hidden className={cn("size-2 rounded-full bg-warn", className)} />
  ) : (
    <span
      aria-label={`${count} waiting`}
      className={cn(
        "num min-w-5 rounded-full bg-warn px-1.5 text-center text-[11px] leading-5 font-bold text-black",
        className,
      )}
    >
      {count}
    </span>
  );
}

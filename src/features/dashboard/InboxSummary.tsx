import { Link } from "@tanstack/react-router";
import { Camera, ChevronRight, Inbox } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useCapture } from "@/app/capture/CaptureProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/convex/useQuery";

/** Inbox summary (FEATURES.md 5.1): how many captures wait on you, a link in, and a capture button. */
export function InboxSummary() {
  const waiting = useQuery(api.ingestion.inbox.pendingCount, {});
  const capture = useCapture();
  if (waiting === undefined) return <Skeleton className="h-20 rounded-xl" />;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2">
      <Link
        to="/inbox"
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-surface-2"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg",
            waiting > 0 ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground",
          )}
        >
          <Inbox className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {waiting > 0 ? `${waiting} waiting for review` : "Inbox clear"}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {waiting > 0 ? "Tag, review and commit your captures" : "Nothing to review right now"}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-subtle-foreground" />
      </Link>
      <Button variant="outline" size="icon" aria-label="New capture" onClick={() => capture.open()}>
        <Camera />
      </Button>
    </div>
  );
}

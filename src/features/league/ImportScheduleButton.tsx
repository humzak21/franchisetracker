import { useAction } from "convex/react";
import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

/**
 * Loads the season's whole league schedule from the real NFL schedule (Madden's first season
 * plays it). Weeks that already have games keep them, so it is safe to press again.
 */
export function ImportScheduleButton({ seasonId }: { seasonId: Id<"seasons"> }) {
  const load = useAction(api.leagueGames.importSchedule.fromNflverse);
  const [state, setState] = useState<{ busy: boolean; message?: string; error?: boolean }>({ busy: false });

  const run = async () => {
    setState({ busy: true });
    try {
      const { weeks, skipped } = await load({ seasonId });
      const kept = skipped > 0 ? `; ${skipped} already had games and were kept` : "";
      setState({ busy: false, message: `Loaded ${weeks} week${weeks === 1 ? "" : "s"}${kept}.` });
    } catch (error) {
      setState({ busy: false, error: true, message: errorMessage(error, "Could not load the schedule") });
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={state.busy} onClick={() => void run()}>
        {state.busy ? <LoaderCircle className="animate-spin" /> : <Download />} Load NFL schedule
      </Button>
      {state.message && (
        <span role="status" className={state.error ? "text-xs text-loss" : "text-xs text-muted-foreground"}>
          {state.message}
        </span>
      )}
    </span>
  );
}

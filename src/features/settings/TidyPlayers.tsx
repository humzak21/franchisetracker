import { useMutation } from "convex/react";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";

/**
 * The one-time pass over players from before provenance was kept. Stays out of the way until
 * someone needs it, then reports what it changed.
 */
export function TidyPlayers() {
  const status = useQuery(api.players.tidy.status, {});
  const start = useMutation(api.players.tidy.start);
  const [error, setError] = useState<string | null>(null);
  const job = status?.job;
  const running = job?.status === "running";
  if (!status || (!status.pending && !job)) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3 text-sm">
      <p className="min-w-0 flex-1 basis-60">
        {running ? (
          <>
            Tidying player records… <span className="num">{job.checked}</span> checked
          </>
        ) : status.pending ? (
          "Some older players have no record of where they came from. Tidy them to date them, mark created players fictional and repair names like “M.Hawkins”."
        ) : (
          <>
            Player records are tidy: <span className="num">{job?.fictional ?? 0}</span> marked fictional,{" "}
            <span className="num">{job?.renamed ?? 0}</span> names repaired.
          </>
        )}
      </p>
      {status.pending && !running && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError(null);
            start({}).catch((e: unknown) => setError(errorMessage(e, "Could not start the tidy")));
          }}
        >
          <Sparkles /> Tidy players
        </Button>
      )}
      {error && <p className="basis-full text-loss">{error}</p>}
    </div>
  );
}

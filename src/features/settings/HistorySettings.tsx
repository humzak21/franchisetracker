import { useMutation, useQuery } from "convex/react";
import { History, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/data/EmptyState";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { formatAge } from "@/lib/time";

const STATUS = {
  running: { tone: "accent", label: "Importing" },
  done: { tone: "win", label: "Up to date" },
  failed: { tone: "loss", label: "Failed" },
} as const;

/** "stats:2014" → "2014 season stats". */
function stepLabel(step: string | undefined): string {
  if (!step) return "";
  if (step.startsWith("stats:")) return `${step.slice(6)} season stats`;
  return (
    {
      seasons: "Seasons and standings",
      players: "Players",
      draft: "Draft history",
      rosters: "First-season rosters",
      careers: "Career totals",
      media: "Logos and headshots",
    }[step] ?? step
  );
}

/**
 * Real NFL history (FEATURES.md 4.8): what the nflverse import brought in, its progress while it
 * runs, and a refresh. Everything it writes is an upsert, so refreshing never duplicates.
 */
export function HistorySettings() {
  const job = useQuery(api.history.imports.status, {});
  const refresh = useMutation(api.history.imports.refresh);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setError(null);
    refresh({}).catch((e: unknown) => setError(errorMessage(e, "Could not start the import")));
  };

  return (
    <Section
      title="Real NFL history"
      description="Every finished season before the franchise from nflverse: standings, playoff results, players, season totals, the draft and first-season rosters."
      actions={
        <Button size="sm" variant="outline" onClick={run} disabled={job?.status === "running"}>
          <RefreshCw /> {job ? "Refresh" : "Import"}
        </Button>
      }
    >
      {job === undefined ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : job === null ? (
        <EmptyState
          icon={History}
          title="Not imported yet"
          description="New franchises import automatically. This one predates the import: start it here."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge tone={STATUS[job.status].tone}>{STATUS[job.status].label}</Badge>
            {job.firstYear !== undefined && (
              <span className="num">
                {job.firstYear}–{job.lastYear}
              </span>
            )}
            <span>
              {job.status === "running"
                ? `Step ${job.stepsDone + 1} of ${job.plan.length}: ${stepLabel(job.plan[job.stepsDone])}`
                : `Finished ${formatAge(job.finishedAt ?? job.startedAt)}`}
            </span>
          </div>
          {job.status === "running" && (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuenow={job.stepsDone}
              aria-valuemax={job.plan.length}
              aria-label="Import progress"
            >
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${(job.stepsDone / job.plan.length) * 100}%` }}
              />
            </div>
          )}
          {job.error && <p className="text-sm text-loss">{job.error}</p>}
          <TileStrip>
            <Tile label="Seasons" value={job.counts.seasons} />
            <Tile label="Players" value={job.counts.players.toLocaleString()} />
            <Tile label="Season rows" value={job.counts.statRows.toLocaleString()} />
            <Tile label="Draft picks" value={job.counts.draftPicks.toLocaleString()} />
          </TileStrip>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
    </Section>
  );
}

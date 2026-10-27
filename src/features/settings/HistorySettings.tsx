import { useMutation } from "convex/react";
import { History, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { earlierRange, splitStep, type YearRange } from "@shared/history/importPlan";
import { EmptyState } from "@/components/data/EmptyState";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { formatAge } from "@/lib/time";
import { useQuery } from "@/lib/convex/useQuery";

const STATUS = {
  running: { tone: "accent", label: "Importing" },
  done: { tone: "win", label: "Up to date" },
  failed: { tone: "loss", label: "Failed" },
} as const;

const STEP_LABELS: Record<string, string> = {
  seasons: "Seasons and standings",
  players: "Players",
  draft: "Draft history",
  rosters: "First-season rosters",
  careers: "Career totals",
  media: "Logos and headshots",
};

/** "stats:2014" → "2014 season stats"; "players:1999-2001" → "Players, 1999–2001". */
function stepLabel(step: string | undefined): string {
  if (!step) return "";
  const [name, arg] = splitStep(step);
  if (name === "stats") return `${arg} season stats`;
  const label = STEP_LABELS[name] ?? name;
  return arg ? `${label}, ${arg.replace("-", "–")}` : label;
}

/** Offers the seasons nflverse covers before the first one this franchise imported. */
function EarlierYears({ range, onImport }: { range: YearRange; onImport: () => void }) {
  const years = `${range.from}–${range.to}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="min-w-0 text-sm text-muted-foreground">
        nflverse now reaches back to <span className="num">{range.from}</span>. Add{" "}
        <span className="num">{years}</span> without redoing the seasons already here.
      </p>
      <Button size="sm" variant="outline" onClick={onImport}>
        <History /> Add <span className="num">{years}</span>
      </Button>
    </div>
  );
}

/**
 * Real NFL history (FEATURES.md 4.8): what the nflverse import brought in, its progress while it
 * runs, a refresh, and the earlier-years import. Everything it writes is an upsert, so neither
 * ever duplicates.
 */
export function HistorySettings() {
  const job = useQuery(api.history.imports.status, {});
  const refresh = useMutation(api.history.imports.refresh);
  const importEarlier = useMutation(api.history.imports.importEarlier);
  const [error, setError] = useState<string | null>(null);
  const start = (mutate: (args: Record<string, never>) => Promise<null>) => () => {
    setError(null);
    mutate({}).catch((e: unknown) => setError(errorMessage(e, "Could not start the import")));
  };
  const run = start(refresh);
  const earlier = job && job.status !== "running" ? earlierRange(job.firstYear) : null;

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
          {earlier && <EarlierYears range={earlier} onImport={start(importEarlier)} />}
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

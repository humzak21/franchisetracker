import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Wrench } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { MAINTENANCE_INFO, type JobOutcome } from "@shared/ops/maintenance";
import { KEEP_OPTIONS } from "@shared/ops/retention";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";
import { formatAge } from "@/lib/time";
import { FixMisreadSheet } from "./FixMisreadSheet";

type Job = FunctionReturnType<typeof api.ops.maintenance.status>["jobs"][number];

/** Lines of a preview shown; the count above them says how many there are. */
const SHOWN_LINES = 8;

function lastRun(last: Job["last"]) {
  if (!last) return "Not run yet";
  if (last.status === "running") return last.summary ? `Running: ${last.summary}` : "Running";
  return `${last.summary ? `${last.summary}, ` : "Finished "}${formatAge(last.at)}`;
}

function JobRow({ job, last }: Job) {
  const preview = useMutation(api.ops.maintenance.preview);
  const run = useMutation(api.ops.maintenance.run);
  const info = MAINTENANCE_INFO[job];
  const [outcome, setOutcome] = useState<JobOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = last?.status === "running";

  const attempt = async (work: () => Promise<void>) => {
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(errorMessage(err, "That did not work. Try again."));
    }
  };
  const start = () =>
    attempt(async () => {
      await run({ job });
      setOutcome(null);
    });

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <div className="text-sm font-medium">{info.label}</div>
          <div className="text-xs text-muted-foreground">{info.detail}</div>
          <div className="mt-0.5 text-xs text-subtle-foreground">{lastRun(last)}</div>
        </div>
        {running ? (
          <Badge tone="accent">Running</Badge>
        ) : info.previews && !outcome?.count ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void attempt(async () => setOutcome(await preview({ job })))}
          >
            Check
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void start()}>
            {info.previews ? "Apply" : "Run"}
          </Button>
        )}
      </div>
      {outcome && (
        <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs">
          <p className="font-medium">{outcome.summary}</p>
          {outcome.lines.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {outcome.lines.slice(0, SHOWN_LINES).map((line) => (
                <li key={line} className="break-words">
                  {line}
                </li>
              ))}
              {outcome.lines.length > SHOWN_LINES && <li>…and {outcome.lines.length - SHOWN_LINES} more</li>}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
    </li>
  );
}

/** Maintenance (FEATURES.md 5.12): the jobs that used to need a terminal, and how long screenshots stay. */
export function MaintenanceSettings() {
  const status = useQuery(api.ops.maintenance.status, {});
  const setKeepDays = useMutation(api.ops.maintenance.setKeepDays);
  const [fixing, setFixing] = useState(false);
  return (
    <Section
      title="Maintenance"
      description="Jobs for the active franchise. Each is safe to run twice."
      actions={
        <Button size="sm" variant="outline" onClick={() => setFixing(true)}>
          <Wrench /> Fix a misread name
        </Button>
      }
    >
      {status === undefined ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {status.jobs.map((job) => (
              <JobRow key={job.job} {...job} />
            ))}
          </ul>
          <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            Keep finished screenshots for
            <Select
              className="w-32"
              aria-label="Keep finished screenshots for"
              value={String(status.keepDays)}
              options={KEEP_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
              onValueChange={(value) => void setKeepDays({ days: Number(value) })}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Checked every night. What a screenshot committed stays for good; the image and its read are gone,
            and backups do not hold them. Rejected screenshots go after 30 days at most.
          </p>
        </div>
      )}
      <FixMisreadSheet open={fixing} onOpenChange={setFixing} />
    </Section>
  );
}

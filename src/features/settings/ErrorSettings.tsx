import { useMutation } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { formatAge } from "@/lib/time";
import { useQuery } from "@/lib/convex/useQuery";

/** New until marked seen, and new again if it happens after that. */
const isNew = (r: { seenAt?: number; lastSeen: number }) => r.seenAt === undefined || r.lastSeen > r.seenAt;

/** Errors (FEATURES.md 8): what broke on any device or in a scheduled job, newest first, with how often. */
export function ErrorSettings() {
  const reports = useQuery(api.ops.errors.recent, {});
  const clear = useMutation(api.ops.errors.clear);
  const markSeen = useMutation(api.ops.errors.markSeen);
  const fresh = (reports ?? []).filter(isNew);
  return (
    <Section
      title="Errors"
      description="Unexpected errors from any device running the app, and scheduled jobs that failed."
      actions={
        reports && reports.length > 0 ? (
          <div className="flex gap-2">
            {fresh.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void markSeen({ ids: fresh.map((r) => r._id) })}
              >
                Mark seen
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void clear({})}>
              Clear
            </Button>
          </div>
        ) : undefined
      }
    >
      {reports === undefined ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : reports.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No errors" description="Nothing has gone wrong lately." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {reports.map((r) => (
            <li key={r._id} className="px-4 py-3">
              <details>
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.message}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.path} · {formatAge(r.lastSeen)}
                    </span>
                  </span>
                  {isNew(r) && <Badge tone="accent">New</Badge>}
                  {r.count > 1 && <Badge tone="warn">×{r.count}</Badge>}
                  <Badge>{r.kind}</Badge>
                </summary>
                {r.stack && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-2 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                    {r.stack}
                  </pre>
                )}
                {r.userAgent && (
                  <p className="mt-2 text-xs break-words text-subtle-foreground">{r.userAgent}</p>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

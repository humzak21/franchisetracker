import { useMutation } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { formatAge } from "@/lib/time";
import { useQuery } from "@/lib/convex/useQuery";

/** Errors (FEATURES.md 8): what broke in the app on any device, newest first, with how often. */
export function ErrorSettings() {
  const reports = useQuery(api.ops.errors.recent, {});
  const clear = useMutation(api.ops.errors.clear);
  return (
    <Section
      title="Errors"
      description="Unexpected errors from any device running the app. Backend errors are in the Convex dashboard logs."
      actions={
        reports && reports.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => void clear({})}>
            Clear
          </Button>
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

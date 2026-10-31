import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

function Lines({ title, lines }: { title: string; lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <h4 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {title}
      </h4>
      <ul className="mt-0.5 text-sm">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** The case on the induction sheet (FEATURES.md 5.7): the record lists, honors and marks, side by side. */
export function HofCasePanel({ playerId, open }: { playerId: Id<"players">; open: boolean }) {
  const data = useQuery(api.hof.case.forPlayer, open ? { playerId } : "skip");
  if (!open) return null;
  if (data === undefined) return <Skeleton className="h-28 rounded-xl" />;
  const years =
    data.firstYear === null
      ? null
      : data.firstYear === data.lastYear
        ? String(data.firstYear)
        : `${data.firstYear} to ${data.lastYear}`;
  const summary = [
    data.seasons > 0 ? `${data.seasons} ${data.seasons === 1 ? "season" : "seasons"} with the team` : null,
    years,
    data.games > 0 ? `${data.games} games` : null,
  ].filter(Boolean);
  const honors = [
    ...data.honors.map((h) => (h.count > 1 ? `${h.count}× ${h.label}` : h.label)),
    ...(data.weekly > 0 ? [`${data.weekly}× Player of the Week`] : []),
  ];
  const lists =
    data.lists > 0
      ? `In ${data.lists} team ${data.lists === 1 ? "list" : "lists"}, first in ${data.firsts}`
      : null;
  return (
    <section aria-label="The case" className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
      <p className="num text-sm font-medium">{summary.join(" · ") || "No seasons on record"}</p>
      {lists && <p className="num text-sm text-muted-foreground">{lists}</p>}
      <Lines title="Honors" lines={honors} />
      <Lines title="Records" lines={data.records} />
      <Lines title="Marks" lines={data.marks} />
    </section>
  );
}

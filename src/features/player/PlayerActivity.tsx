import { useQuery } from "convex/react";
import { Medal } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AWARD_INFO, TRANSACTION_LABELS, weekLabel } from "@shared/domain";
import { EmptyState } from "@/components/data/EmptyState";
import { Badge, Skeleton } from "@/components/ui/misc";

function List({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {title}
      </h3>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">{children}</ul>
    </section>
  );
}

const Row = ({ year, children }: { year: number; children: ReactNode }) => (
  <li className="flex min-h-11 items-center gap-3 px-3 py-1.5 text-sm">
    <span className="num w-10 shrink-0 text-xs text-muted-foreground">{year}</span>
    {children}
  </li>
);

/**
 * The player page's awards cabinet, the moves involving them, and their injuries
 * (FEATURES.md 5.4, 5.8, 5.10).
 */
export function PlayerActivity({ playerId }: { playerId: Id<"players"> }) {
  const awards = useQuery(api.awards.awards.forPlayer, { playerId });
  const activity = useQuery(api.players.activity.forPlayer, { playerId });
  if (awards === undefined || activity === undefined) return <Skeleton className="h-32 rounded-xl" />;
  if (awards.length === 0 && activity.transactions.length === 0 && activity.injuries.length === 0) {
    return (
      <EmptyState
        icon={Medal}
        title="Nothing yet"
        description="Awards, signings, trades and injuries show up here as they are captured."
      />
    );
  }
  return (
    <div className="@container grid gap-4 @desktop:grid-cols-3">
      {awards.length > 0 && (
        <List title="Awards">
          {awards.map((a) => (
            <Row key={a._id} year={a.year}>
              <span className="min-w-0 flex-1 truncate font-medium">
                {a.customName ?? AWARD_INFO[a.type].label}
              </span>
              {a.weekKey && <span className="text-xs text-muted-foreground">{weekLabel(a.weekKey)}</span>}
            </Row>
          ))}
        </List>
      )}
      {activity.transactions.length > 0 && (
        <List title="Moves">
          {activity.transactions.map((t) => (
            <Row key={t._id} year={t.year}>
              <Badge>{TRANSACTION_LABELS[t.type]}</Badge>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {[t.team?.abbr, t.counterpart && `with ${t.counterpart.abbr}`, t.notes]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Row>
          ))}
        </List>
      )}
      {activity.injuries.length > 0 && (
        <List title="Injuries">
          {activity.injuries.map((i) => (
            <Row key={i._id} year={i.year}>
              <span className="min-w-0 flex-1 truncate">
                {[i.injuryType, i.lengthLabel].filter(Boolean).join(" · ")}
              </span>
              {i.onIr && <Badge tone="loss">IR</Badge>}
              {i.weekKey && <span className="text-xs text-muted-foreground">{weekLabel(i.weekKey)}</span>}
            </Row>
          ))}
        </List>
      )}
    </div>
  );
}

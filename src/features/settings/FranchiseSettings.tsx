import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatRecord } from "@shared/stats";
import { useSwitchFranchise } from "@/app/franchise";
import { Section } from "@/components/layout/Section";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { DeleteFranchise } from "./DeleteFranchise";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";

/**
 * Franchises (FEATURES.md 5.12): every franchise with its team and latest season, switching
 * between them, starting another, and deleting one that is not active. Exactly one is active;
 * the rest keep their data.
 */
export function FranchiseSettings() {
  const franchises = useQuery(api.franchise.franchises.list, {});
  const switchTo = useSwitchFranchise();
  const [pending, setPending] = useState<Id<"franchises"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = (franchiseId: Id<"franchises">) => {
    setPending(franchiseId);
    setError(null);
    switchTo(franchiseId)
      .catch((err: unknown) => setError(errorMessage(err, "Could not switch franchises.")))
      .finally(() => setPending(null));
  };

  return (
    <Section
      title="Franchises"
      description="Every screen, the inbox and the Shortcut follow the active franchise."
      actions={
        <Button asChild size="sm" variant="outline">
          <Link to="/franchises/new">
            <Plus /> New franchise
          </Link>
        </Button>
      }
    >
      {franchises === undefined ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {franchises.map((f) => (
            <li key={f._id} className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3">
              <TeamLogo team={f.userTeam} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{f.name}</span>
                  {f.isActive && <Badge tone="accent">Active</Badge>}
                  {f.deleting && <Badge tone="warn">Deleting</Badge>}
                </div>
                <div className="num truncate text-sm text-muted-foreground">
                  {f.userTeam.city} {f.userTeam.name} · since {f.startYear}
                  {f.current && ` · ${f.current.year} ${formatRecord(f.current)}`}
                </div>
              </div>
              {!f.isActive && !f.deleting && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() => choose(f._id)}
                  aria-label={`Switch to ${f.name}`}
                >
                  {pending === f._id ? "Switching…" : "Switch"}
                </Button>
              )}
              {!f.isActive && !f.deleting && <DeleteFranchise franchiseId={f._id} name={f.name} />}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-loss">
          {error}
        </p>
      )}
    </Section>
  );
}

import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatRecord } from "@shared/stats";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { useSwitchFranchise } from "../franchise";

/**
 * Every franchise with its team and latest season; tapping one makes it the active franchise.
 * Shared by the sidebar's switcher and the phone's More sheet. `onDone` closes whatever holds it.
 */
export function FranchiseList({ onDone }: { onDone?: () => void }) {
  const franchises = useQuery(api.franchise.franchises.list, {});
  const switchTo = useSwitchFranchise();
  const [pending, setPending] = useState<Id<"franchises"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (franchiseId: Id<"franchises">) => {
    setPending(franchiseId);
    setError(null);
    try {
      await switchTo(franchiseId);
      onDone?.();
    } catch (err) {
      setError(errorMessage(err, "Could not switch franchises."));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-1">
      {franchises === undefined ? (
        <Skeleton className="h-14 rounded-lg" />
      ) : (
        <ul aria-label="Franchises" className="space-y-1">
          {franchises
            .filter((f) => !f.deleting)
            .map((f) => (
              <li key={f._id}>
                <button
                  type="button"
                  aria-current={f.isActive ? "true" : undefined}
                  disabled={pending !== null}
                  onClick={() => (f.isActive ? onDone?.() : void choose(f._id))}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-60",
                    f.isActive && "bg-surface-2",
                  )}
                >
                  <TeamLogo team={f.userTeam} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{f.name}</span>
                    <span className="num block truncate text-xs text-muted-foreground">
                      {f.userTeam.name}
                      {f.current && ` · ${f.current.year} · ${formatRecord(f.current)}`}
                    </span>
                  </span>
                  {f.isActive && <Check className="size-4 shrink-0 text-primary" aria-label="Active" />}
                  {pending === f._id && <span className="text-xs text-muted-foreground">Switching…</span>}
                </button>
              </li>
            ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="px-2.5 text-sm text-loss">
          {error}
        </p>
      )}
      <Link
        to="/franchises/new"
        onClick={onDone}
        className="flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-surface-2"
      >
        <span className="grid size-7 place-items-center rounded-lg border border-dashed border-border-strong">
          <Plus className="size-4" />
        </span>
        New franchise
      </Link>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight, UserCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";

type Side = FunctionReturnType<typeof api.players.identity.duplicates>[number]["captured"];

function Who({ side }: { side: Side }) {
  return (
    <Link
      to="/players/$playerId"
      params={{ playerId: side.playerId }}
      className="inline-flex min-w-0 items-center gap-1.5 hover:text-primary"
    >
      <PositionBadge position={side.position} />
      <span className="truncate font-medium">{side.displayName}</span>
      {side.imported && <Badge>NFL</Badge>}
    </Link>
  );
}

/**
 * Identity tools (FEATURES.md 5.4) across the franchise: players entered twice from box scores,
 * and name corrections from review that still match players carrying the misread name.
 */
export function IdentitySettings() {
  const duplicates = useQuery(api.players.identity.duplicates, {});
  const corrections = useQuery(api.players.identity.nameCorrections, {});
  const merge = useMutation(api.players.identity.merge);
  const apply = useMutation(api.players.identity.applyNameCorrection);
  const [error, setError] = useState<string | null>(null);
  const attempt = (fn: () => Promise<unknown>) => {
    setError(null);
    fn().catch((e: unknown) => setError(errorMessage(e, "Could not update the players")));
  };

  const empty = duplicates?.length === 0 && corrections?.length === 0;
  return (
    <Section
      title="Player identity"
      description="Merge duplicates and apply name corrections from review in bulk."
    >
      {duplicates === undefined || corrections === undefined ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : empty ? (
        <EmptyState
          icon={UserCheck}
          title="Every player is one person"
          description="Nothing looks duplicated, and every corrected name is applied."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {duplicates.map(({ captured, match }) => (
            <li
              key={`${captured.playerId}-${match.playerId}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 text-sm"
            >
              <Who side={captured} />
              <ArrowRight className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
              <Who side={match} />
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() =>
                  attempt(() => merge({ sourceId: captured.playerId, targetId: match.playerId }))
                }
              >
                Merge
              </Button>
            </li>
          ))}
          {corrections.map((c) => (
            <li key={`${c.from}-${c.to}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 text-sm">
              <span className="min-w-0">
                <span className="text-muted-foreground">Review fixed </span>
                <span className="font-medium">“{c.from}”</span>
                <span className="text-muted-foreground"> to </span>
                <span className="font-medium">“{c.to}”</span>
                <span className="block text-xs text-muted-foreground">
                  {c.players.length} player{c.players.length === 1 ? "" : "s"} still named “{c.from}”
                  {c.existing ? `; merges into ${c.existing.displayName}` : "; renames them"}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => attempt(() => apply({ from: c.from, to: c.to }))}
              >
                Apply
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
    </Section>
  );
}
